import { Request, Response } from 'express';
import { getPool } from '../singletons/db';

// Download LLMs.txt by ID
// Typically better to store the SQL logic into a separate layer for SoC, but for now this is fine
export const downloadById = async (
    req: Request,
    res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      'SELECT content FROM llms_entries WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    
    res.json({ content: result.rows[0].content });
  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
}; 