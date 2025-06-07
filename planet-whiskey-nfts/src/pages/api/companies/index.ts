import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Company, { ICompany } from '@/models/Company';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    await dbConnect();

    switch (method) {
      case 'GET':
        try {
          const companies: ICompany[] = await Company.find({});
          res.status(200).json({ success: true, data: companies });
        } catch (error) {
          console.error("Error fetching companies from DB:", error);
          res.status(500).json({ success: false, message: "Failed to retrieve companies from database." });
        }
        break;
      default:
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${method} Not Allowed`);
        break;
    }
  } catch (dbConnectionError) {
    console.error("!!! API Error (likely DB connection issue) /api/companies !!!:", dbConnectionError);
    res.status(500).json({ success: false, message: "Internal Server Error - Could not connect to service." });
  }
} 