/**
 * The import sheet reads a Verilog project with regexes rather than a second
 * yosys round trip, so these are the cases that decide whether it asks the user
 * the right question — or the wrong one.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyFile,
  detectModules,
  detectTopCandidates,
  looksLikeFirmware,
  matchFirmware,
  type ProjectFile,
  parseParameters,
  parseRepoUrl,
  sourceFolders,
} from './verilog-project';

const src = (path: string, content: string): ProjectFile => ({
  path,
  content,
  role: 'source',
});

describe('classifyFile', () => {
  it('splits compiled sources from includes from data', () => {
    expect(classifyFile('rtl/serv_alu.v')).toBe('source');
    expect(classifyFile('rtl/pkg.sv')).toBe('source');
    expect(classifyFile('inc/defines.vh')).toBe('include');
    expect(classifyFile('sw/hello_uart.hex')).toBe('data');
    expect(classifyFile('README.md')).toBe('data');
  });
});

describe('detectModules', () => {
  it('ignores module names that only appear in comments', () => {
    const source = `
      // This module for decoding by the way
      /* another module inside a block comment */
      module real_one(input a); endmodule
    `;
    expect(detectModules(source)).toEqual(['real_one']);
  });
});

describe('detectTopCandidates', () => {
  const leaf = src('leaf.v', 'module leaf(input a, output b); endmodule');
  const mid = src(
    'mid.v',
    'module mid(input a, output b);\n leaf u_leaf (.a(a), .b(b));\nendmodule',
  );
  const topOfIt = src(
    'top.v',
    'module top_soc(input a, output b);\n mid #(.W(1)) u_mid (.a(a), .b(b));\nendmodule',
  );

  it('returns only the modules nothing instantiates', () => {
    expect(detectTopCandidates([leaf, mid, topOfIt])).toEqual(['top_soc']);
  });

  it('does not treat a prefix match as an instantiation', () => {
    // `soc` is a prefix of `soc_ram`, so a name match without a trailing word
    // boundary makes the SoC look like it instantiates itself.
    const ram = src('ram.v', 'module soc_ram(input a); endmodule');
    const soc = src('soc.v', 'module soc(input a);\n soc_ram #(.D(8)) ram (.a(a));\nendmodule');
    expect(detectTopCandidates([ram, soc])).toEqual(['soc']);
  });

  it('puts the root that pulls in the most of the file set first', () => {
    // A wrapper around a leaf is a root too, but it is not the one to offer.
    const wrapper = src('wrap.v', 'module wrapper(input a);\n leaf w (.a(a));\nendmodule');
    expect(detectTopCandidates([leaf, mid, topOfIt, wrapper])).toEqual(['top_soc', 'wrapper']);
  });

  it('falls back to every module when nothing looks like a root', () => {
    const a = src('a.v', 'module a(input x);\n b u_b (.x(x));\nendmodule');
    const b = src('b.v', 'module b(input x);\n a u_a (.x(x));\nendmodule');
    expect(detectTopCandidates([a, b]).sort()).toEqual(['a', 'b']);
  });

  it('is empty for a file set with no modules', () => {
    expect(detectTopCandidates([src('notes.v', '// nothing here')])).toEqual([]);
  });
});

describe('parseParameters', () => {
  it('reads body-declared parameters with their defaults, the way SERV writes them', () => {
    const servant = src(
      'servant.v',
      `module servant
       (input wire wb_clk, input wire wb_rst, output wire q);
         parameter memfile = "zephyr_hello.hex";
         parameter memsize = 8192;
         parameter reset_strategy = "MINI";
         parameter [0:0] debug = 1'b0;
         parameter [0:0] compress = 0;
         parameter [0:0] align = compress;
       endmodule`,
    );
    expect(parseParameters([servant], 'servant')).toEqual([
      { name: 'memfile', defaultValue: 'zephyr_hello.hex', kind: 'string' },
      { name: 'memsize', defaultValue: '8192', kind: 'number' },
      { name: 'reset_strategy', defaultValue: 'MINI', kind: 'string' },
      { name: 'debug', defaultValue: "1'b0", kind: 'number' },
      { name: 'compress', defaultValue: '0', kind: 'number' },
      // Only meaningful once elaborated, so it is shown but not sent.
      { name: 'align', defaultValue: 'compress', kind: 'expression' },
    ]);
  });

  it('reads header-declared parameters too', () => {
    const header = src(
      'fifo.v',
      'module fifo #(parameter integer DEPTH = 16, parameter WIDTH = 8) (input clk); endmodule',
    );
    expect(parseParameters([header], 'fifo')).toEqual([
      { name: 'DEPTH', defaultValue: '16', kind: 'number' },
      { name: 'WIDTH', defaultValue: '8', kind: 'number' },
    ]);
  });

  it('stops at endmodule rather than bleeding into the next module', () => {
    const two = src(
      'two.v',
      'module first;\n parameter A = 1;\nendmodule\nmodule second;\n parameter B = 2;\nendmodule',
    );
    expect(parseParameters([two], 'first').map((p) => p.name)).toEqual(['A']);
  });

  it('is empty for a module that is not in the file set', () => {
    expect(parseParameters([src('a.v', 'module a; endmodule')], 'missing')).toEqual([]);
  });
});

describe('firmware binding', () => {
  const data: ProjectFile[] = [
    { path: 'sw/blinky.hex', content: '', role: 'data' },
    { path: 'sw/zephyr_hello.hex', content: '', role: 'data' },
  ];

  it('matches the RTL default on basename, not full path', () => {
    expect(matchFirmware('zephyr_hello.hex', data)).toBe('sw/zephyr_hello.hex');
    expect(matchFirmware('fw/zephyr_hello.hex', data)).toBe('sw/zephyr_hello.hex');
  });

  it('reports no match rather than guessing', () => {
    expect(matchFirmware('nowhere.hex', data)).toBeUndefined();
  });

  it('recognises a memory-image default', () => {
    expect(looksLikeFirmware({ name: 'memfile', defaultValue: 'a.hex', kind: 'string' })).toBe(
      true,
    );
    expect(looksLikeFirmware({ name: 'style', defaultValue: 'MINI', kind: 'string' })).toBe(false);
    expect(looksLikeFirmware({ name: 'n', defaultValue: '8192', kind: 'number' })).toBe(false);
  });
});

describe('parseRepoUrl', () => {
  it('accepts the forms people paste', () => {
    expect(parseRepoUrl('https://github.com/olofk/serv')).toEqual({ owner: 'olofk', repo: 'serv' });
    expect(parseRepoUrl('https://github.com/olofk/serv.git')).toEqual({
      owner: 'olofk',
      repo: 'serv',
    });
    expect(parseRepoUrl('olofk/serv')).toEqual({ owner: 'olofk', repo: 'serv' });
  });

  it('keeps the branch and folder from a browsed URL', () => {
    expect(parseRepoUrl('https://github.com/olofk/serv/tree/main/rtl')).toEqual({
      owner: 'olofk',
      repo: 'serv',
      ref: 'main',
      path: 'rtl',
    });
  });

  it('rejects anything that is not a GitHub repo', () => {
    expect(parseRepoUrl('https://gitlab.com/olofk/serv')).toBeUndefined();
    expect(parseRepoUrl('olofk')).toBeUndefined();
    expect(parseRepoUrl('')).toBeUndefined();
  });
});

describe('sourceFolders', () => {
  it('leads with the folder holding the most Verilog', () => {
    expect(
      sourceFolders(['rtl/a.v', 'rtl/b.v', 'rtl/c.v', 'bench/tb.v', 'README.md', 'top.v']),
    ).toEqual([
      { folder: 'rtl', count: 3 },
      { folder: '', count: 1 },
      { folder: 'bench', count: 1 },
    ]);
  });
});
