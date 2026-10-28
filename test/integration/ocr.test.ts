import assert from 'node:assert/strict';
import { test } from 'node:test';
import { file2text } from '../../source/index.js';
import { png } from '../fixtures.js';

test('real Tesseract worker recognizes a generated PNG with the three-language model', async () => {
    const text = await file2text(png());
    assert.match(text.replace(/\s+/g, ' '), /HELLO WORLD/i);
});
