import { useCallback, useState } from 'react';
import { extractText } from '@/lib/extract-text';

export interface UseResumeFileReturn {
  file: File | null;
  fileText: string;
  fileParsing: boolean;
  fileError: string;
  dragging: boolean;
  handleFile: (f: File) => Promise<void>;
  clear: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export function useResumeFile(): UseResumeFileReturn {
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState('');
  const [fileParsing, setFileParsing] = useState(false);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setFileError('');
    setFileParsing(true);
    try {
      const text = await extractText(f);
      setFileText(text);
    } catch (e) {
      setFileError((e as Error).message);
      setFile(null);
    } finally {
      setFileParsing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setFile(null);
    setFileText('');
    setFileError('');
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  return { file, fileText, fileParsing, fileError, dragging, handleFile, clear, onDragOver, onDragLeave, onDrop };
}
