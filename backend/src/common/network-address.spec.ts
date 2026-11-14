import { describe, expect, it } from 'vitest';
import { isPublicAddress } from './network-address.js';

describe('isPublicAddress', () => {
  it.each([
    '0.0.0.0',
    '0.1.2.3',
    '10.1.2.3',
    '100.64.0.0',
    '100.127.255.255',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.0',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.2.1',
    '192.88.99.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.7',
    '203.0.113.9',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
  ])('refuses IPv4 %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '::',
    '::1',
    '::2',
    '64:ff9b::808:808',
    '100::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fec0::1',
    'ff02::1',
    '2001::1',
    '2001:1ff::1',
    '2001:db8::1',
    '2002:808:808::1',
    '3fff::1',
    '3fff:fff::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.5',
    '::ffff:a9fe:a9fe',
    '::ffff:192.168.0.1',
    'fe80::1%eth0',
  ])('refuses IPv6 %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.0',
    '100.63.255.255',
    '100.128.0.0',
    '169.253.255.255',
    '223.255.255.255',
    '2606:4700:4700::1111',
    '2001:200::1',
    '2400:cb00::1',
    '::ffff:8.8.8.8',
    '::ffff:808:808',
  ])('accepts %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    '',
    'example.com',
    'localhost',
    '1.2.3',
    '999.1.1.1',
    '::g',
    ' 8.8.8.8',
  ])('refuses garbage %j', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
