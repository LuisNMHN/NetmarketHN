'use client'

import { useState, useEffect, useCallback } from 'react'

export type StepKey = 'datos' | 'doc' | 'selfie' | 'domicilio' | 'revision'
export type StepStatus = 'locked' | 'active' | 'done'

export type WizardState = {
  current: StepKey
  status: Record<StepKey, StepStatus>
  flags: {
    datosOk: boolean
    docFrontalOk: boolean
    docReversoOk: boolean
    selfieOk: boolean
    domicilioOk: boolean
    aceptoDeclaracion: boolean
  }
}

export type WizardApi = {
  state: WizardState
  setFlag: (key: keyof WizardState['flags'], value: boolean) => void
  canContinue: () => boolean
  goNext: () => void
  goPrev: () => void
  goTo: (step: StepKey) => void
  reset: () => void
}

const STORAGE_KEY = 'kycProgress'

const INITIAL_STATE: WizardState = {
  current: 'datos',
  status: {
    datos: 'active',
    doc: 'locked',
    selfie: 'locked',
    domicilio: 'locked',
    revision: 'locked'
  },
  flags: {
    datosOk: false,
    docFrontalOk: false,
    docReversoOk: false,
    selfieOk: false,
    domicilioOk: false,
    aceptoDeclaracion: false
  }
}

const STEP_ORDER: StepKey[] = ['datos', 'doc', 'selfie', 'domicilio', 'revision']

export function useKycWizard(): WizardApi {
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  // Cargar estado desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsedState = JSON.parse(saved) as WizardState
        setState(parsedState)
      }
    } catch (error) {
      console.warn('Error loading wizard state from localStorage:', error)
    }
  }, [])

  // Guardar estado en localStorage en cada cambio
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('Error saving wizard state to localStorage:', error)
    }
  }, [state])

  const setFlag = useCallback((key: keyof WizardState['flags'], value: boolean) => {
    setState(prev => ({
      ...prev,
      flags: {
        ...prev.flags,
        [key]: value
      }
    }))
  }, [])

  const canContinue = useCallback((): boolean => {
    const { current, flags } = state

    switch (current) {
      case 'datos':
        return flags.datosOk
      case 'doc':
        return flags.docFrontalOk && flags.docReversoOk
      case 'selfie':
        return flags.selfieOk
      case 'domicilio':
        return flags.domicilioOk
      case 'revision':
        return flags.aceptoDeclaracion
      default:
        return false
    }
  }, [state])

  const goNext = useCallback(() => {
    if (!canContinue()) return

    const currentIndex = STEP_ORDER.indexOf(state.current)
    if (currentIndex === -1 || currentIndex === STEP_ORDER.length - 1) return

    const nextStep = STEP_ORDER[currentIndex + 1]
    
    setState(prev => ({
      ...prev,
      current: nextStep,
      status: {
        ...prev.status,
        [prev.current]: 'done',
        [nextStep]: 'active'
      }
    }))
  }, [state.current, canContinue])

  const goPrev = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.current)
    if (currentIndex <= 0) return

    const prevStep = STEP_ORDER[currentIndex - 1]
    
    setState(prev => ({
      ...prev,
      current: prevStep,
      status: {
        ...prev.status,
        [prev.current]: 'active',
        [prevStep]: 'active'
      }
    }))
  }, [state.current])

  const goTo = useCallback((step: StepKey) => {
    const stepStatus = state.status[step]
    
    // Solo permitir navegación a pasos 'done' o al paso actual
    if (stepStatus === 'locked' || (stepStatus === 'active' && step !== state.current)) {
      return
    }

    setState(prev => ({
      ...prev,
      current: step
    }))
  }, [state.status, state.current])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Error clearing wizard state from localStorage:', error)
    }
  }, [])

  return {
    state,
    setFlag,
    canContinue,
    goNext,
    goPrev,
    goTo,
    reset
  }
}

