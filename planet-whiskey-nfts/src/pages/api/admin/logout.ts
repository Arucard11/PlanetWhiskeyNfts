import type { NextApiRequest, NextApiResponse } from 'next';
import { withIronSessionApiRoute } from 'next-iron-session';
import { sessionOptions } from '../../../lib/session'; // Adjusted path if necessary
import { IronSessionData } from 'next-iron-session';

interface NextApiRequestWithAdminSession extends NextApiRequest {
  session: IronSessionData;
}

async function logoutHandler(req: NextApiRequestWithAdminSession, res: NextApiResponse) {
  req.session.destroy(); // Destroys the session
  res.status(200).json({ message: 'Logout successful', isLoggedIn: false });
}

export default withIronSessionApiRoute(logoutHandler, sessionOptions); 