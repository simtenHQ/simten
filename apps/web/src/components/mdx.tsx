import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { McpInstall } from './McpInstall';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    McpInstall,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
