import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface FileItem {
  name: string;
  type: 'image' | 'video' | 'other';
  size?: number;
  lastModified?: string;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const publicDir = path.join(process.cwd(), 'public');
    const files = fs.readdirSync(publicDir);
    
    const fileList: FileItem[] = files
      .filter(file => !file.startsWith('.')) // Exclude hidden files
      .map(file => {
        const filePath = path.join(publicDir, file);
        const stats = fs.statSync(filePath);
        
        // Determine file type based on extension
        const ext = path.extname(file).toLowerCase();
        let type: 'image' | 'video' | 'other' = 'other';
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'].includes(ext)) {
          type = 'image';
        } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].includes(ext)) {
          type = 'video';
        }
        
        return {
          name: file,
          type,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ files: fileList });
  } catch (error) {
    console.error('Error reading public directory:', error);
    res.status(500).json({ message: 'Error reading files' });
  }
} 