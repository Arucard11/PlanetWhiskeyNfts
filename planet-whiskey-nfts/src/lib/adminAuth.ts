import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { getIronSession, IronSession, SessionOptions } from 'iron-session'; // Import from new package
import { sessionOptions } from './session'; // Your existing options
// Removed: import { IronSessionData } from 'next-iron-session';
// Removed: import { withIronSessionApiRoute } from 'next-iron-session';

// Define the session data structure (consistent with lib/session.ts and other API routes)
interface AdminSessionData {
  admin?: {
    username: string;
    isLoggedIn: boolean;
  };
}

// No longer need NextApiRequestWithAdminSession defined here, as getIronSession types the session on the fly.

export function withAdminAuth(handler: NextApiHandler) {
  return async function (req: NextApiRequest, res: NextApiResponse) {
    try {
    const session = await getIronSession<AdminSessionData>(req, res, sessionOptions as SessionOptions);
    const adminUser = session.admin;

    if (!adminUser?.isLoggedIn) {
        console.log('[WITH_ADMIN_AUTH] Unauthorized: No admin user session or not logged in.');
      return res.status(401).json({ message: 'Unauthorized: Not logged in' });
    }

    // If you have roles, you could check them here:
    // if (adminUser.role !== 'admin') { // Assuming role would be on adminUser if used
    //   return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    // }
      console.log('[WITH_ADMIN_AUTH] Admin user authenticated. Proceeding to handler.');
    return handler(req, res);
    } catch (error: any) {
      console.error('[WITH_ADMIN_AUTH_ERROR] Error in admin authentication HOC:', error);
      if (error.stack) {
        console.error('[WITH_ADMIN_AUTH_ERROR] Stack trace:', error.stack);
      }
      return res.status(500).json({ 
        message: 'Server error during authentication process.', 
        error: error.message,
        details: error.toString(),
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    }
  };
}

// Example of how to get the current admin user if needed - this would now be done within the route handler itself
// after calling getIronSession. This specific helper might be less necessary or refactored.
// For instance, a route using withAdminAuth would already have the session checked.
// If a route *not* using withAdminAuth needed the admin, it would call getIronSession itself.
/* 
export async function getCurrentAdmin(req: NextApiRequest): Promise<AdminSessionData['admin'] | undefined> {
  const session = await getIronSession<AdminSessionData>(req, {} as NextApiResponse, sessionOptions as SessionOptions);
  // Note: Passing {} as NextApiResponse is a hack if only reading session and not setting cookies.
  // Proper usage in a read-only scenario (like middleware or a non-API route helper) 
  // would involve using cookies() from next/headers if in App Router, or carefully managing response.
  return session.admin;
}
*/ 