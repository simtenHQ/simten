/**
 * LabelEditor Component
 *
 * Inline input field for editing component labels.
 */

'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface LabelEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  position: { x: number; y: number };
}

export function LabelEditor({ initialValue, onSave, onCancel, position }: LabelEditorProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select text
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Save on blur
    onSave(value.trim());
  };

  return (
    <div
      className="fixed z-[100]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="rounded border-2 border-blue-500 bg-white px-2 py-1 text-sm font-medium shadow-lg focus:outline-none"
        style={{ minWidth: '80px' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
