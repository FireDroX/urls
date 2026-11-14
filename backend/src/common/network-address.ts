import { BlockList, isIP } from 'node:net';

const REFUSED_IPV4_SUBNETS: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const REFUSED_IPV6_SUBNETS: ReadonlyArray<[string, number]> = [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
];

const refusedIpv4 = new BlockList();
for (const [network, prefix] of REFUSED_IPV4_SUBNETS) {
  refusedIpv4.addSubnet(network, prefix, 'ipv4');
}

const refusedIpv6 = new BlockList();
for (const [network, prefix] of REFUSED_IPV6_SUBNETS) {
  refusedIpv6.addSubnet(network, prefix, 'ipv6');
}

const globalUnicastIpv6 = new BlockList();
globalUnicastIpv6.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  return !refusedIpv4.check(address, 'ipv4');
}

function isPublicIpv6(address: string): boolean {
  if (address.includes('%')) return false;
  const mapped = embeddedIpv4(address);
  if (mapped) return isPublicIpv4(mapped);
  return (
    globalUnicastIpv6.check(address, 'ipv6') &&
    !refusedIpv6.check(address, 'ipv6')
  );
}

function embeddedIpv4(address: string): string | null {
  const groups = expandIpv6(address);
  if (!groups) return null;
  const isMapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (!isMapped) return null;
  const [high, low] = [groups[6], groups[7]];
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function expandIpv6(address: string): number[] | null {
  let text = address.toLowerCase();
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number);
    if (octets.length !== 4 || octets.some((o) => !(o >= 0 && o <= 255))) {
      return null;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }
  const [head, rest, extra] = text.split('::');
  if (extra !== undefined) return null;
  const headGroups = head ? head.split(':') : [];
  const restGroups = rest ? rest.split(':') : [];
  let groups: string[];
  if (rest === undefined) {
    groups = headGroups;
  } else {
    const missing = 8 - headGroups.length - restGroups.length;
    if (missing < 0) return null;
    groups = [
      ...headGroups,
      ...Array<string>(missing).fill('0'),
      ...restGroups,
    ];
  }
  if (groups.length !== 8) return null;
  const values = groups.map((group) => parseInt(group, 16));
  return values.some(Number.isNaN) ? null : values;
}
