// import { GetServerSidePropsContext, GetServerSidePropsResult, NextApiHandler } from 'next'; // No longer needed for HOCs

const sessionPassword = process.env.SESSION_SECRET;

if (!sessionPassword) {
  throw new Error('SESSION_SECRET environment variable is not set.');
}

export const sessionOptions = {
  password: sessionPassword,
  cookieName: 'whiskey-planet-session', // You can name your cookie
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const, // Can be 'strict', 'lax', or 'none'
  },
};

// This is where we specify the typings of req.session.* 
// This declaration should still work with the new iron-session if the session structure is the same.
// Ensure the module name matches the new package: 'iron-session'
declare module 'iron-session' { // Changed from 'next-iron-session'
  interface IronSessionData {
    admin?: {
      username: string;
      isLoggedIn: boolean;
    };
    // You can add other session data types here if needed
  }
}

// The HOCs withAdminSessionApiRoute and withAdminSessionSsr are removed.
// API routes will now call getIronSession directly. 