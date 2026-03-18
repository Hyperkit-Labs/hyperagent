// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill for SIWE/crypto in jsdom
import { TextEncoder, TextDecoder } from 'util'
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder
