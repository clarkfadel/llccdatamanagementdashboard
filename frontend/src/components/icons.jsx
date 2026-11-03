// icons from lucide-react, wrapped so they all have the same size and stroke
import {
  Users,
  LayoutGrid,
  Cross,
  CreditCard,
  Link2,
  Copy,
  BarChart3,
  History,
  ArrowRight,
} from 'lucide-react';

// default size 20
const base = { size: 20, strokeWidth: 1.7 };

export const Icon = {
  clients: (p) => <Users {...base} {...p} />,
  lots: (p) => <LayoutGrid {...base} {...p} />,
  deceased: (p) => <Cross {...base} {...p} />,
  transactions: (p) => <CreditCard {...base} {...p} />,
  link: (p) => <Link2 {...base} {...p} />,
  copy: (p) => <Copy {...base} {...p} />,
  chart: (p) => <BarChart3 {...base} {...p} />,
  history: (p) => <History {...base} {...p} />,
  arrow: (p) => <ArrowRight {...base} {...p} />,
};
