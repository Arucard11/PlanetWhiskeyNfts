import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { sessionOptions } from '../../../lib/session';
import dbConnect from '../../../lib/mongodb';
import AdminUser from '../../../models/AdminUser';

interface AdminSessionData {
  admin?: {
    username: string;
    isLoggedIn: boolean;
  };
}

type NextApiRequestWithAdminSession = NextApiRequest & {
  session: IronSession<AdminSessionData>;
};

export default async function loginRoute(req: NextApiRequestWithAdminSession, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const session = await getIronSession<AdminSessionData>(req, res, sessionOptions as SessionOptions);

  const { username, password } = req.body;
  console.log('[LOGIN_ATTEMPT]', { username });

  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required' });
    return;
  }

  try {
    console.time('[LOGIN_TIMING_DB_CONNECT]');
    await dbConnect();
    console.timeEnd('[LOGIN_TIMING_DB_CONNECT]');
    console.log('[LOGIN_DB_CONNECT]', 'Successfully connected to DB for login attempt');

    console.time('[LOGIN_TIMING_FIND_USER]');
    const admin = await AdminUser.findOne({ username });
    console.timeEnd('[LOGIN_TIMING_FIND_USER]');

    if (!admin) {
      console.log('[LOGIN_FAIL]', `Admin user '${username}' not found in database.`);
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    console.log('[LOGIN_USER_FOUND]', `Admin user '${username}' found. Hash from DB: ${admin.passwordHash}`);

    console.time('[LOGIN_TIMING_PW_COMPARE]');
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    console.timeEnd('[LOGIN_TIMING_PW_COMPARE]');
    console.log('[LOGIN_PW_COMPARE]', `Password valid for user '${username}': ${isPasswordValid}`);

    if (!isPasswordValid) {
      console.log('[LOGIN_FAIL]', `Password comparison failed for user '${username}'.`);
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    session.admin = {
      username: admin.username,
      isLoggedIn: true,
    };
    console.time('[LOGIN_TIMING_SESSION_SAVE]');
    await session.save();
    console.timeEnd('[LOGIN_TIMING_SESSION_SAVE]');

    res.status(200).json({ message: 'Login successful', user: { username: session.admin.username } });
  } catch (error) {
    console.error('[LOGIN_ERROR]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
} 