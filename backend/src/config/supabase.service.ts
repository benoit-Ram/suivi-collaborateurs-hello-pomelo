import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL et SUPABASE_KEY sont requis. Vérifiez vos variables d\'environnement.');
    }
    this.client = createClient(url, key);
  }

  get db(): SupabaseClient {
    return this.client;
  }
}
