/**
 * ComponentPalette Component
 *
 * Displays available components that can be dragged onto the canvas.
 * Components are organized into collapsible groups that expand on hover.
 * Features a fuzzy search with keyboard shortcuts and highlighting.
 */

'use client';

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useIRStore, useMetadataStore } from '../stores';
import type { ComponentType } from '../types';
import { ComponentTooltip, PortInfo } from './ComponentTooltip';

interface PaletteItem {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;
  inputs?: PortInfo[];
  outputs?: PortInfo[];
}

interface ComponentCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  items: PaletteItem[];
}

/**
 * Custom hook to debounce a value
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Fuzzy match algorithm for flexible search
 */
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let queryIndex = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
}

/**
 * Component to highlight matching characters in search results
 */
interface HighlightedTextProps {
  text: string;
  query: string;
}

function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) {
    return <>{text}</>;
  }

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let queryIndex = 0;

  for (let i = 0; i < text.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      // Add non-matching text before this character
      if (i > lastIndex) {
        result.push(text.slice(lastIndex, i));
      }
      // Add matching character with highlight
      result.push(
        <mark key={i} className="bg-yellow-200 font-semibold">
          {text[i]}
        </mark>
      );
      lastIndex = i + 1;
      queryIndex++;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return <>{result}</>;
}

// Component definitions organized by category
const COMPONENT_CATEGORIES: ComponentCategory[] = [
  {
    id: 'input-output',
    label: 'Input/Output',
    icon: '⚡',
    description: 'User controls and visual indicators',
    items: [
      {
        type: 'SWITCH',
        label: 'Switch',
        description: 'User-controlled input that can be toggled ON or OFF',
        icon: '⚡',
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'LED',
        label: 'LED',
        description: 'Visual indicator that lights up when input signal is ON',
        icon: '💡',
        inputs: [{ index: 0, label: 'Input', value: undefined }],
      },
    ],
  },
  {
    id: 'basic-gates',
    label: 'Basic Gates',
    icon: '&',
    description: 'Fundamental logic operations',
    items: [
      {
        type: 'AND_GATE',
        label: 'AND Gate',
        description: 'Output is ON when both inputs are ON',
        icon: '&',
        inputs: [
          { index: 0, label: 'A', value: undefined },
          { index: 1, label: 'B', value: undefined },
        ],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'OR_GATE',
        label: 'OR Gate',
        description: 'Output is ON when at least one input is ON',
        icon: '≥1',
        inputs: [
          { index: 0, label: 'A', value: undefined },
          { index: 1, label: 'B', value: undefined },
        ],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'NOT_GATE',
        label: 'NOT Gate',
        description: 'Output is the inverse of the input',
        icon: '¬',
        inputs: [{ index: 0, label: 'Input', value: undefined }],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'BUFFER',
        label: 'Buffer',
        description: 'Passes input to output unchanged',
        icon: '▷',
        inputs: [{ index: 0, label: 'Input', value: undefined }],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
    ],
  },
  {
    id: 'advanced-gates',
    label: 'Advanced Gates',
    icon: '⊕',
    description: 'Complex logic operations',
    items: [
      {
        type: 'NAND_GATE',
        label: 'NAND Gate',
        description: 'Output is OFF only when both inputs are ON',
        icon: '⊼',
        inputs: [
          { index: 0, label: 'A', value: undefined },
          { index: 1, label: 'B', value: undefined },
        ],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'NOR_GATE',
        label: 'NOR Gate',
        description: 'Output is ON only when both inputs are OFF',
        icon: '⊽',
        inputs: [
          { index: 0, label: 'A', value: undefined },
          { index: 1, label: 'B', value: undefined },
        ],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'XOR_GATE',
        label: 'XOR Gate',
        description: 'Output is ON when inputs are different',
        icon: '⊕',
        inputs: [
          { index: 0, label: 'A', value: undefined },
          { index: 1, label: 'B', value: undefined },
        ],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
      {
        type: 'XNOR_GATE',
        label: 'XNOR Gate',
        description: 'Output is ON when inputs are the same',
        icon: '⊙',
        inputs: [
          { index: 0, label: 'A', value: undefined },
          { index: 1, label: 'B', value: undefined },
        ],
        outputs: [{ index: 0, label: 'Output', value: undefined }],
      },
    ],
  },
];

interface ComponentGroupProps {
  category: ComponentCategory;
  onDragStart: (event: React.DragEvent, componentType: ComponentType) => void;
  onComponentClick: (componentType: ComponentType) => void;
  isSearchActive: boolean;
  highlightTerm: string;
}

function ComponentGroup({
  category,
  onDragStart,
  onComponentClick,
  isSearchActive,
  highlightTerm,
}: ComponentGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Force expansion when search is active
  const shouldExpand = isSearchActive || isExpanded;

  // Keep group expanded while dragging from it
  const handleMouseLeave = () => {
    if (!isDragging) {
      setIsExpanded(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, componentType: ComponentType) => {
    setIsDragging(true);
    onDragStart(e, componentType);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setIsExpanded(false);
  };

  // Disable hover expansion when search is active
  const handleMouseEnter = () => {
    if (!isSearchActive) {
      setIsExpanded(true);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Category Header - Always Visible */}
      <div
        className={cn(
          'cursor-pointer rounded-lg border-2 border-gray-300 bg-gradient-to-br from-white to-gray-50 p-3 shadow-sm transition-all duration-200',
          shouldExpand && 'border-blue-400 shadow-md'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-xl">
            {category.icon}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">{category.label}</div>
            <div className="text-xs text-gray-500">{category.items.length} components</div>
          </div>
          <div
            className={cn(
              'text-gray-400 transition-transform duration-300',
              shouldExpand && 'rotate-180'
            )}
          >
            ▼
          </div>
        </div>
      </div>

      {/* Expanded Items - Show on Hover or Search */}
      <div
        className={cn(
          'mt-2 space-y-2 overflow-hidden transition-all duration-300 ease-in-out',
          shouldExpand ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {category.items.map((item, index) => (
          <ComponentTooltip
            key={item.type}
            title={item.label.toUpperCase()}
            description={item.description}
            inputs={item.inputs}
            outputs={item.outputs}
            delayMs={300}
          >
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              onDragEnd={handleDragEnd}
              onClick={() => onComponentClick(item.type)}
              className={cn(
                'cursor-move rounded-lg border-2 border-gray-200 bg-white p-2.5 shadow-sm transition-all',
                'hover:border-blue-400 hover:shadow-md active:scale-95',
                'ml-4' // Indent items to show hierarchy
              )}
              style={{
                // Stagger animation for visual polish
                transitionDelay: shouldExpand ? `${index * 30}ms` : '0ms',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-50 text-lg">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    <HighlightedText text={item.label} query={highlightTerm} />
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {item.inputs ? `${item.inputs.length}i` : ''}
                    {item.inputs && item.outputs ? ' / ' : ''}
                    {item.outputs ? `${item.outputs.length}o` : ''}
                  </div>
                </div>
              </div>
            </div>
          </ComponentTooltip>
        ))}
      </div>
    </div>
  );
}

export function ComponentPalette() {
  const addComponent = useIRStore((state) => state.addComponent);
  const setComponentMetadata = useMetadataStore((state) => state.setComponentMetadata);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 200);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const onDragStart = useCallback((event: React.DragEvent, componentType: ComponentType) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/reactflow', componentType);
  }, []);

  const handleClick = useCallback(
    (componentType: ComponentType) => {
      // Add component to IR
      const componentId = addComponent(componentType);

      // Add metadata with default position (center of canvas)
      setComponentMetadata(componentId, {
        id: componentId,
        position: { x: 250, y: 250 }, // Default position
      });
    },
    [addComponent, setComponentMetadata]
  );

  // Filter categories and items based on search query
  const filteredCategories = useMemo(() => {
    if (!debouncedQuery) {
      return COMPONENT_CATEGORIES;
    }

    return COMPONENT_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          fuzzyMatch(item.label, debouncedQuery) ||
          fuzzyMatch(item.description, debouncedQuery) ||
          fuzzyMatch(item.type, debouncedQuery)
      ),
    })).filter((category) => category.items.length > 0);
  }, [debouncedQuery]);

  // Calculate total results count
  const totalResults = useMemo(() => {
    return filteredCategories.reduce((sum, category) => sum + category.items.length, 0);
  }, [filteredCategories]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on "/" key
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Clear search on "Escape" key
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const isSearchActive = debouncedQuery.length > 0;

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Components</h2>
        <p className="text-xs text-gray-500">Hover to expand, drag or click to add</p>
      </div>

      {/* Search Input */}
      <div className="border-b border-gray-200 p-4">
        <div className="relative">
          {/* Search Icon */}
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </div>

          {/* Input Field */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search components... (press /)"
            className={cn(
              'w-full rounded-lg border-2 pl-9 pr-9 py-2 text-sm transition-colors',
              'focus:outline-none',
              isSearchFocused ? 'border-blue-400' : 'border-gray-300'
            )}
          />

          {/* Clear Button */}
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {isSearchActive && (
          <div className="mt-2 text-xs text-gray-600">
            {totalResults} component{totalResults !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Component Groups */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredCategories.length > 0 ? (
          <div className="space-y-3">
            {filteredCategories.map((category) => (
              <ComponentGroup
                key={category.id}
                category={category}
                onDragStart={onDragStart}
                onComponentClick={handleClick}
                isSearchActive={isSearchActive}
                highlightTerm={debouncedQuery}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No results found
          </div>
        )}
      </div>

      {/* Info */}
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">
          <strong>Tip:</strong> {isSearchActive ? 'Press ESC to clear search' : 'Hover over a category to see available components'}
        </p>
      </div>
    </div>
  );
}
