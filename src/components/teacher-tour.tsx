import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import type { DriveStep } from "driver.js"
import { useEffect } from "react"

import { toastFailure, toastUnexpected } from "@/components/use-result-mutation"
import { createSampleExam, examsQuery } from "@/server/exams"

// shortcut: znacznik w localStorage, więc nowa przeglądarka pokaże przewodnik znowu; przenieść do konta, jeśli to przeszkadza
const DONE_KEY = "terminus:tour-done"

// Przewodnik przechodzi na stronę zaliczenia, więc żyje dłużej niż komponent, który go uruchomił.
let started = false

const step = (
  element: string | undefined,
  title: string,
  description: string,
  extra?: Pick<NonNullable<DriveStep["popover"]>, "showButtons" | "onNextClick">,
): DriveStep => ({
  element: element && `[data-tour="${element}"]`,
  popover: { title, description, ...extra },
})

const waitFor = (selector: string) =>
  new Promise<void>((resolve) => {
    const check = (framesLeft: number) =>
      document.querySelector(selector) || framesLeft === 0
        ? resolve()
        : requestAnimationFrame(() => check(framesLeft - 1))
    check(180)
  })

export function TeacherTour() {
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (started || localStorage.getItem(DONE_KEY)) return
    let cancelled = false
    void import("driver.js").then(({ driver }) => {
      if (cancelled || started) return
      started = true
      const pending = { current: false }
      const sample = { examId: "" }
      const advance = (work: () => Promise<boolean>) => async () => {
        if (pending.current) return
        pending.current = true
        try {
          if (await work()) tour.moveNext()
        } catch (error) {
          toastUnexpected(error)
        } finally {
          pending.current = false
        }
      }
      const showTab = async (tab: "lista" | "sloty", anchor: string) => {
        await router.navigate({
          to: "/zaliczenia/$examId",
          params: { examId: sample.examId },
          search: { tab },
        })
        await waitFor(`[data-tour="${anchor}"]`)
        return true
      }
      const openSample = advance(async () => {
        const result = await createSampleExam()
        if (!result.ok) {
          toastFailure(result)
          return false
        }
        sample.examId = result.examId
        await queryClient.invalidateQueries({ queryKey: examsQuery().queryKey })
        return showTab("lista", "roster-import")
      })
      const showSlots = advance(() => showTab("sloty", "exam-slots"))
      const tour = driver({
        showProgress: true,
        progressText: "{{current}} z {{total}}",
        nextBtnText: "Dalej",
        prevBtnText: "Wstecz",
        doneBtnText: "Gotowe",
        popoverClass: "terminus-tour",
        disableActiveInteraction: true,
        onDestroyed: () => localStorage.setItem(DONE_KEY, "1"),
        steps: [
          step(
            undefined,
            "Witaj w Terminusie",
            "Pokażemy w kilku krokach, jak działa zaliczenie. Przewodnik zamkniesz w każdej chwili krzyżykiem albo klawiszem Esc.",
          ),
          step("new-exam", "Nowe zaliczenie", "Tak zaczynasz własne zaliczenie."),
          step(
            undefined,
            "Przykładowe zaliczenie",
            "Resztę pokażemy na przykładzie. „Dalej” założy na twoim koncie zaliczenie z listą 6 osób, 6 slotami za tydzień i 2 zapisami. Potem możesz je zmieniać albo usunąć.",
            { onNextClick: () => void openSample() },
          ),
          step(
            "exam-tabs",
            "Karty zaliczenia",
            "Lista indeksów mówi, kto może się zapisać, a Sloty to okna czasu podzielone na równe sloty. W Ustawieniach zmienisz sposób przydziału i start zapisów, a w Prowadzących dodasz innych prowadzących po e-mailu.",
            { showButtons: ["next", "close"] },
          ),
          step(
            "roster-import",
            "Import studentów",
            "Bez listy indeksów nikt się nie zapisze. Wczytaj plik CSV wyeksportowany z USOS: przed zapisaniem zobaczysz, kto dojdzie, a kto zniknie. Pojedyncze osoby dodasz formularzem niżej. Przykład ma już listę 6 osób.",
            { onNextClick: () => void showSlots() },
          ),
          step(
            "exam-slots",
            "Sloty",
            "Tu dodajesz okna czasu i widzisz, kto zajął który slot. W przykładzie dwa sloty są już zajęte.",
            { showButtons: ["next", "close"] },
          ),
          step(
            "student-link",
            "Link dla studentów",
            "Ten link wysyłasz studentom. Pod nim zapisują się na slot.",
          ),
          step(
            "board",
            "Tablica zapisów",
            "Na tablicy przeciągasz osoby między slotami i wystawiasz oceny.",
          ),
          step(
            "exam-actions",
            "Eksport, kopia, usunięcie",
            "Eksport do CSV, kopia zaliczenia na poprawkę i usunięcie. Tu usuniesz też przykładowe zaliczenie.",
          ),
          step(
            "account",
            "Twoje konto",
            "Tu zmienisz hasło, zarządzasz weryfikacją dwuetapową i się wylogujesz.",
          ),
        ],
      })
      tour.drive()
    })
    return () => {
      cancelled = true
    }
  }, [router, queryClient])
  return null
}
