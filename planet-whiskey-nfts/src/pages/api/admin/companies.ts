import type { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '../../../lib/adminAuth'; // Adjusted path
import dbConnect from '../../../lib/mongodb';         // Adjusted path
import Company from '../../../models/Company';         // Adjusted path

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { name, description } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Company name is required and must be a string.' });
      }
      if (description && typeof description !== 'string') {
        return res.status(400).json({ message: 'Company description must be a string if provided.' });
      }

      await dbConnect();

      const newCompany = new Company({
        name,
        description: description || null, // Ensure description is null if not provided or empty
      });

      await newCompany.save();

      return res.status(201).json({ message: 'Company created successfully', company: newCompany });
    } catch (error: any) {
      console.error('[ADMIN_CREATE_COMPANY_ERROR]', error);
      if (error.code === 11000) { // MongoDB duplicate key error
        return res.status(409).json({ message: 'A company with this name already exists.' });
      }
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } else if (req.method === 'GET') {
    try {
      await dbConnect();
      const companies = await Company.find({}).sort({ createdAt: -1 });
      return res.status(200).json({ companies });
    } catch (error) {
      console.error('[ADMIN_GET_COMPANIES_ERROR]', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}

export default withAdminAuth(handler); 