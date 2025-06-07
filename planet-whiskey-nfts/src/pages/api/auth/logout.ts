import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { sessionOptions } from '../../../lib/session'; // Changed path to be relative to `pages/api/auth`

// Define the session data structure (can be imported from a shared types file eventually)
interface AdminSessionData {
  admin?: {
    username: string;
    isLoggedIn: boolean;
  };
}

export default async function logoutRoute(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { 
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const session = await getIronSession<AdminSessionData>(req, res, sessionOptions as SessionOptions);
  await session.destroy(); // Destroys the session
  
  res.status(200).json({ message: 'Logout successful', isLoggedIn: false }); // Explicitly state logged out
} 