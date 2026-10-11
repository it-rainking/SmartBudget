'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

// Chart.js pesa più di tutto il resto della dashboard: i grafici arrivano
// in un chunk a parte, così numeri e testi compaiono senza aspettarli.
// ssr: false perché Chart.js disegna su canvas e lato server non produce
// nulla. Il segnaposto riempie il contenitore, che ha già un'altezza fissa.
const placeholder = () => <Skeleton className="h-full w-full rounded-lg" />

export const Line = dynamic(() => import('./chartImpl').then((m) => m.Line), { ssr: false, loading: placeholder })
export const Bar = dynamic(() => import('./chartImpl').then((m) => m.Bar), { ssr: false, loading: placeholder })
export const Doughnut = dynamic(() => import('./chartImpl').then((m) => m.Doughnut), { ssr: false, loading: placeholder })
