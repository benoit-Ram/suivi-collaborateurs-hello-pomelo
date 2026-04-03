import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import { SupabaseService } from '../../config/supabase.service';

const GOOGLE_CLIENT_ID = '583500042273-qg3a9puk3prhl3hbqfr2jbbtljcgorco.apps.googleusercontent.com';
const SUPER_ADMIN_EMAIL = 'benoit@hello-pomelo.com';
const JWT_SECRET = process.env.JWT_SECRET || 'hp-suivi-collab-secret-change-me-in-production';
const JWT_EXPIRY = '24h';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(private supabase: SupabaseService) {
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

    // Find collaborateur by email (case-insensitive)
    const { data: collab } = await this.supabase.db
      .from('collaborateurs')
      .select('id, email, prenom, nom, is_admin, photo_url')
      .ilike('email', payload.email.toLowerCase())
      .single();

    if (!collab) throw new UnauthorizedException(`Aucun collaborateur pour ${payload.email}`);

    const isSuperAdmin = payload.email.toLowerCase() === SUPER_ADMIN_EMAIL;
    const isAdmin = isSuperAdmin || collab.is_admin === true;

    // Save Google photo if available
    if (payload.picture && payload.picture !== collab.photo_url) {
      await this.supabase.db.from('collaborateurs').update({ photo_url: payload.picture }).eq('id', collab.id);
    }

    // Issue our own JWT
    const appToken = jwt.sign(
      {
        sub: collab.id,
        email: payload.email.toLowerCase(),
        name: payload.name || `${collab.prenom} ${collab.nom}`,
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
        name: payload.name || `${collab.prenom} ${collab.nom}`,
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
