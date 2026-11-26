import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server"

const startFetch = createStartHandler(defaultStreamHandler)

export default createServerEntry({
  async fetch(request, opts) {
    try {
      return await startFetch(request, opts)
    } catch (e) {
      // Zamknięta karta w trakcie zapytania: Start rzuca powód przerwania, a domyślny wpis loguje go jako błąd.
      if (request.signal.aborted && e === request.signal.reason)
        return new Response(null, { status: 499 })
      throw e
    }
  },
})
