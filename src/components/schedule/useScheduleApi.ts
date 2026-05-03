'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

const base = process.env.NEXT_PUBLIC_API_BASE_URL

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Service {
  serviceId: string
  name: string
  duration: number
  price: number
  description?: string | null
  active: boolean
}

export interface Appointment {
  appointmentId: string
  date: string
  time: string
  serviceId: string
  service?: Service
  clientName: string
  clientEmail: string
  clientPhone: string
  status: AppointmentStatus
  notes?: string | null
}

export interface WorkingHoursEntry {
  workingHoursId?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface BlockedSlot {
  blockedSlotId: string
  date: string
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// ─── Services ────────────────────────────────────────────────────────────────

export const useServices = () => {
  const { data: session } = useSession()
  return useQuery<Service[]>({
    queryKey: ['schedule-services'],
    queryFn: async () => {
      const { data } = await axios.get(`${base}/schedule/services`, {
        headers: authHeader(session!.accessToken!),
      })
      return data
    },
    enabled: !!session?.accessToken,
  })
}

export const useCreateService = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<Service, 'serviceId'>) =>
      axios.post(`${base}/schedule/services`, body, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-services'] }),
  })
}

export const useUpdateService = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Service> & { id: string }) =>
      axios.put(`${base}/schedule/services/${id}`, body, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-services'] }),
  })
}

export const useDeleteService = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      axios.delete(`${base}/schedule/services/${id}`, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-services'] }),
  })
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export const useAppointments = (params: { date?: string; month?: string; status?: string }) => {
  const { data: session } = useSession()
  return useQuery<Appointment[]>({
    queryKey: ['schedule-appointments', params],
    queryFn: async () => {
      const { data } = await axios.get(`${base}/schedule/appointments`, {
        headers: authHeader(session!.accessToken!),
        params,
      })
      return data
    },
    enabled: !!session?.accessToken,
  })
}

export const useCreateAppointmentBO = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<Appointment, 'appointmentId' | 'service' | 'status'>) =>
      axios.post(`${base}/schedule/appointments`, body, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-appointments'] }),
  })
}

export const useUpdateAppointment = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status?: AppointmentStatus; notes?: string }) =>
      axios.put(`${base}/schedule/appointments/${id}`, { status, notes }, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-appointments'] }),
  })
}

export const useDeleteAppointment = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      axios.delete(`${base}/schedule/appointments/${id}`, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-appointments'] }),
  })
}

// ─── Working Hours ────────────────────────────────────────────────────────────

export const useWorkingHours = () => {
  const { data: session } = useSession()
  return useQuery<WorkingHoursEntry[]>({
    queryKey: ['schedule-working-hours'],
    queryFn: async () => {
      const { data } = await axios.get(`${base}/schedule/working-hours`, {
        headers: authHeader(session!.accessToken!),
      })
      return data
    },
    enabled: !!session?.accessToken,
  })
}

export const useSaveWorkingHours = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hours: WorkingHoursEntry[]) =>
      axios.post(`${base}/schedule/working-hours`, { hours }, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-working-hours'] }),
  })
}

// ─── Blocked Slots ────────────────────────────────────────────────────────────

export const useBlockedSlots = (month?: string) => {
  const { data: session } = useSession()
  return useQuery<BlockedSlot[]>({
    queryKey: ['schedule-blocked-slots', month],
    queryFn: async () => {
      const { data } = await axios.get(`${base}/schedule/blocked-slots`, {
        headers: authHeader(session!.accessToken!),
        params: month ? { month } : {},
      })
      return data
    },
    enabled: !!session?.accessToken,
  })
}

export const useCreateBlockedSlot = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<BlockedSlot, 'blockedSlotId'>) =>
      axios.post(`${base}/schedule/blocked-slots`, body, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-blocked-slots'] }),
  })
}

export const useDeleteBlockedSlot = () => {
  const { data: session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      axios.delete(`${base}/schedule/blocked-slots/${id}`, {
        headers: authHeader(session!.accessToken!),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-blocked-slots'] }),
  })
}
