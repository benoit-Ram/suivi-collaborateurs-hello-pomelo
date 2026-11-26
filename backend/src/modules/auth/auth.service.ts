import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import { sql } from 'kysely';
import { DatabaseService } from '../../config/database.service';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID environment variable is required. Set it in backend/.env');
const SUPER_ADMIN_EMAIL = 'benoit@hello-pomelo.com';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required. Set it in backend/.env');
// 7 jours — équilibre entre sécurité et confort. Les 120 collabs ne se reconnectent
// qu'une fois par semaine. Si compromis, faire tourner JWT_SECRET invalidera tout.
const JWT_EXPIRY = '7d';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(private database: DatabaseService) {
    this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }

  /** Verify Google credential and issue app JWT */
  async login(googleCredential: string) {
    // Verify Google JWT server-side
    let payload: any;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleCredential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      throw new UnauthorizedException('Token Google invalide');
    }

    if (!payload?.email) throw new UnauthorizedException('Email manquant dans le token');

    // Restrict to @hello-pomelo.com domain
    if (!payload.email.toLowerCase().endsWith('@hello-pomelo.com')) {
      throw new UnauthorizedException('Seuls les comptes @hello-pomelo.com sont autorises.');
    }

    // Find collaborateur by email (case-insensitive). Kysely n'a pas de .ilike
    // générique — on utilise une comparaison lowered des deux côtés.
    const emailLower = payload.email.toLowerCase();
    const collab = await this.database.db
      .selectFrom('collaborateurs')
      .select(['id', 'email', 'prenom', 'nom', 'is_admin', 'photo_url'])
      .where(sql<boolean>`lower(${sql.ref('email')}) = ${emailLower}`)
      .executeTakeFirst();

    if (!collab) throw new UnauthorizedException(`Aucun collaborateur pour ${payload.email}`);

    const isSuperAdmin = emailLower === SUPER_ADMIN_EMAIL;
    const isAdmin = isSuperAdmin || collab.is_admin === true;

    // Save Google photo if available
    if (payload.picture && payload.picture !== collab.photo_url) {
      await this.database.db
        .updateTable('collaborateurs')
        .set({ photo_url: payload.picture })
        .where('id', '=', collab.id)
        .execute();
    }

    // Issue our own JWT
    const appToken = jwt.sign(
      {
        sub: collab.id,
        email: payload.email.toLowerCase(),
        name: `${collab.prenom} ${collab.nom}`,
        picture: payload.picture || collab.photo_url,
        isAdmin,
        isSuperAdmin,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    return {
      token: appToken,
      user: {
        email: payload.email,
        name: `${collab.prenom} ${collab.nom}`,
        picture: payload.picture || collab.photo_url,
        collabId: collab.id,
        isAdmin,
        isSuperAdmin,
      },
    };
  }

  /** Verify our app JWT from Authorization header */
  verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch (e) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
