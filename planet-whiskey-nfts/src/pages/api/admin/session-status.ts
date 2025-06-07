import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession, IronSession, SessionOptions } from 'iron-session'; // Import from new package
import { sessionOptions } from '../../../lib/session'; // Correct path from pages/api/admin/
// Removed: import { withAdminSessionApiRoute } from '../../../lib/session';
// Removed: import { IronSessionData } from 'next-iron-session'; // Old type

interface AdminSessionData {
  admin?: {
    username: string;
    isLoggedIn: boolean;
  };
}

export default async function sessionStatusHandler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<AdminSessionData>(req, res, sessionOptions as SessionOptions);
  const adminUser = session.admin;

  if (adminUser?.isLoggedIn) {
    res.status(200).json({ 
      isLoggedIn: true, 
      user: { username: adminUser.username } 
    });
  } else {
    res.status(200).json({ isLoggedIn: false });
  }
} 