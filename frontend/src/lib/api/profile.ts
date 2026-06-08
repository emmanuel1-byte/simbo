/**
 * Profile API resource.
 *
 * Backend endpoints (all under /api/v1, require auth):
 *   GET  /profile/   → { fullname, email }
 *   PUT  /profile/   { fullname, email } → { fullname, email }
 */

import { http, unwrap } from './http';

interface ProfileData {
  fullname: string;
  email: string;
}

export const profileApi = {
  async get(): Promise<ProfileData> {
    return unwrap<ProfileData>(http.get('/profile/'));
  },

  async update(fullname: string, email: string): Promise<ProfileData> {
    return unwrap<ProfileData>(http.put('/profile/', { fullname, email }));
  },
};
