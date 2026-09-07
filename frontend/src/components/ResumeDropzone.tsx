import { useRef } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { UseResumeFileReturn } from '@/hooks/useResumeFile';

export function ResumeDropzone({ resume, label = 'Resume' }: { resume: UseResumeFileReturn; label?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { file, fileText, fileParsing, fileError, dragging, handleFile, clear, onDragOver, onDragLeave, onDrop } = resume;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150',
          dragging
            ? 'border-primary bg-primary/5'
            : file
            ? 'border-sage-400 bg-sage-50 dark:border-sage-700 dark:bg-sage-900/10'
            : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileParsing ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Parsing {file?.name}…</p>
          </div>
        ) : file && !fileError ? (
          <div className="flex items-center justify-center gap-2">
            <div className="text-left">
              <p className="text-sm font-medium text-sage-700 dark:text-sage-400">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {fileText.split(/\s+/).length} words extracted
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); clear(); }} className="ml-2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-muted-foreground">
            <Upload className="h-7 w-7 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Drop your resume or <span className="text-primary font-medium">browse</span>
            </p>
            <p className="text-xs mt-1 opacity-60">PDF, DOCX, or TXT · max 5 MB</p>
          </div>
        )}

        {fileError && <p className="mt-2 text-xs text-destructive">{fileError}</p>}
      </div>
    </div>
  );
}
