/**
 * kevtris's nestest ROM and its reference log from Nintendulator. Downloaded
 * at run time into ./.cache (gitignored), never committed.
 */

import { join } from 'node:path';

export const CACHE = join(import.meta.dirname, '.cache');

export const FILES = [
  {
    name: 'nestest.nes',
    url: 'https://www.qmtpro.com/~nes/misc/nestest.nes',
    sha256: 'f67d55fd6b3cf0bad1cc85f1df0d739c65b53e79cecb7fea8f77ec0eadab0004',
  },
  {
    name: 'nestest.log',
    url: 'https://www.qmtpro.com/~nes/misc/nestest.log',
    sha256: '627c8e180b1a924dfa705c5dc6958fad7ab75a62de556173caf880ccc1337540',
  },
] as const;

export const ROM_PATH = join(CACHE, 'nestest.nes');
export const LOG_PATH = join(CACHE, 'nestest.log');
