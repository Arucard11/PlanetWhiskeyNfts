import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '../../../lib/session'; // Adjusted path if necessary

interface AdminSessionData {
  admin?: {
    username: string;
    isLoggedIn: boolean;
  };
}

export default async function logoutHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getIronSession<AdminSessionData>(req, res, sessionOptions);
  session.destroy(); // Destroys the session
  res.status(200).json({ message: 'Logout successful', isLoggedIn: false });
} 