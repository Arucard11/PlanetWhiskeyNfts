import type { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Company from '@/models/Company';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { companyId } = req.query;

  if (!companyId || typeof companyId !== 'string') {
    return res.status(400).json({ message: 'Company ID is required' });
  }

  try {
    await dbConnect();

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    await Company.findByIdAndDelete(companyId);

    res.status(200).json({ 
      success: true, 
      message: 'Company deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete company',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withAdminAuth(handler); 