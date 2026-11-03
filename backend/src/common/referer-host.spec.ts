import { describe, expect, it } from 'vitest';
import { refererHost } from './referer-host.js';
import { EVENT_REFERER_HOST_MAX_LENGTH } from './variables.global.js';

describe('refererHost', () => {
  it.each([
    ['https://news.example/a', 'news.example'],
    ['http://news.example/b?x=1#top', 'news.example'],
    ['https://user:pass@news.example/post', 'news.example'],
    ['https://192.0.2.4/', '192.0.2.4'],
    ['https://[2001:db8::1]/', '[2001:db8::1]'],
  ])('reads the host of %s', (referer, host) => {
    expect(refererHost(referer)).toBe(host);
  });

  it('groups two pages of the same site under one host', () => {
    expect(refererHost('https://news.example/a')).toBe(
      refererHost('https://news.example/b'),
    );
  });

  it('lowercases the host', () => {
    expect(refererHost('HTTPS://News.EXAMPLE/Post')).toBe('news.example');
  });

  it('drops the port', () => {
    expect(refererHost('https://news.example:8443/post')).toBe('news.example');
  });

  it('encodes an internationalised host', () => {
    expect(refererHost('https://café.example/')).toBe('xn--caf-dma.example');
  });

  it.each([undefined, ''])(
    'returns null for a missing referer (%j)',
    (referer) => {
      expect(refererHost(referer)).toBeNull();
    },
  );

  it.each([
    'not a url',
    '/relative/path',
    'news.example/post',
    'http://',
    'https://exa mple.com/',
  ])('returns null for an invalid URL (%s)', (referer) => {
    expect(refererHost(referer)).toBeNull();
  });

  it.each([
    'android-app://com.google.android.gm/',
    'ftp://files.example/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,hi',
    'about:blank',
  ])('returns null for a non-http(s) referer (%s)', (referer) => {
    expect(refererHost(referer)).toBeNull();
  });

  it('truncates an oversized host', () => {
    const label = 'a'.repeat(60);
    const host = Array.from({ length: 6 }, () => label).join('.');

    expect(refererHost(`https://${host}/`)).toHaveLength(
      EVENT_REFERER_HOST_MAX_LENGTH,
    );
  });
});
