/**
 * ComponentLibrary Component
 *
 * Browser UI for viewing all components in the library:
 * - Primitives
 * - Standard library
 * - User-defined components
 */

'use client';

import React, { useState } from 'react';
import { useCircuitLibraryStore } from '@turing-incomplete/ui/editor/stores';
import type { Circuit } from '@turing-incomplete/ui/editor/types';

type TabType = 'primitives' | 'standard' | 'user';

interface ComponentItemProps {
  circuit: Circuit;
  onRemove?: () => void;
}

function ComponentItem({ circuit, onRemove }: ComponentItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded bg-white">
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:text-blue-600 flex-1 text-left"
        >
          <span className="text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
          {circuit.name}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50"
            title="Remove component"
          >
            Remove
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-2">
          {/* Inputs */}
          {circuit.inputs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Inputs</h4>
              <div className="space-y-1">
                {circuit.inputs.map((input) => (
                  <div key={input.name} className="text-xs font-mono text-gray-700">
                    {input.name}: {input.portType.kind === 'bit' ? 'bit' : `bus<${input.portType.width}>`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outputs */}
          {circuit.outputs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Outputs</h4>
              <div className="space-y-1">
                {circuit.outputs.map((output) => (
                  <div key={output.name} className="text-xs font-mono text-gray-700">
                    {output.name}: {output.portType.kind === 'bit' ? 'bit' : `bus<${output.portType.width}>`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clocks */}
          {circuit.clocks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Clocks</h4>
              <div className="space-y-1">
                {circuit.clocks.map((clock) => (
                  <div key={clock.name} className="text-xs font-mono text-gray-700">
                    {clock.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {circuit.metadata?.description && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Description</h4>
              <p className="text-xs text-gray-600">{circuit.metadata?.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ComponentLibrary() {
  const [activeTab, setActiveTab] = useState<TabType>('user');

  const {
    getAllPrimitiveNames,
    getAllStandardNames,
    getAllUserNames,
    getPrimitive,
    getStandard,
    getUser,
    removeUser,
  } = useCircuitLibraryStore();

  const primitiveNames = getAllPrimitiveNames();
  const standardNames = getAllStandardNames();
  const userNames = getAllUserNames();

  const getComponents = (tab: TabType): Circuit[] => {
    switch (tab) {
      case 'primitives':
        return primitiveNames.map(name => getPrimitive(name)!).filter(Boolean);
      case 'standard':
        return standardNames.map(name => getStandard(name)!).filter(Boolean);
      case 'user':
        return userNames.map(name => getUser(name)!).filter(Boolean);
    }
  };

  const components = getComponents(activeTab);

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'user', label: 'User', count: userNames.length },
    { id: 'standard', label: 'Standard', count: standardNames.length },
    { id: 'primitives', label: 'Primitives', count: primitiveNames.length },
  ];

  return (
    <div className="flex flex-col h-full bg-white border-l">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">Component Library</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-4">
        {components.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {activeTab === 'user' ? (
              <>
                <p className="mb-2">No user-defined components yet.</p>
                <p className="text-xs">Compile DSL code to create components.</p>
              </>
            ) : (
              <p>No {activeTab} components available.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {components.map((circuit) => (
              <ComponentItem
                key={circuit.name}
                circuit={circuit}
                onRemove={activeTab === 'user' ? () => removeUser(circuit.name) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
