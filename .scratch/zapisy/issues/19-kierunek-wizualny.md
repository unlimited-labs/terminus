# Kierunek wizualny

Type: prototype
Status: resolved

## Question

Jak ma wyglądać aplikacja: kolory, kroje pisma, gęstość, ton — wspólny dla
strony studenta (plansza, bilet) i części prowadzącego (tabela, formularze)?
Prototypy [Strona studenta](09-strona-studenta.md) i
[Tablica zapisów prowadzącego](10-tablica-zapisow-prowadzacego.md) ustaliły
układ, nie wygląd. Kilka wariantów wizualnych na tych dwóch ekranach, ze
skillem `/frontend-design`, w ramach shadcn/ui (Base UI) + Tailwind v4.

## Assets

- Prototyp (3 kierunki na dwóch ekranach): [prototypes/kierunek-wizualny.html](../prototypes/kierunek-wizualny.html)

## Answer

Wybrany wariant C prototypu ("Przyjazny"). A (uczelniany) i B (warsztat) odrzucone.

- Kolory (zmienne motywu shadcn/ui): tło `#F4F3FF`, powierzchnia `#FFFFFF`, tekst `#1D1B3A`, tekst drugorzędny `#6B6890`, linie `#E2DFF5`, akcent (główne przyciski, "Twój" slot, bilet) `#4B3FD6`, zajęty slot / kafelek `#ECEAFD`, wolny slot mięta `#17A673`, ostrzeżenia i błędy `#C2255C`.
- Krój: Figtree (400/600/800) do wszystkiego; godziny cyframi tabelarycznymi.
- Kształt: duże zaokrąglenia (małe elementy 12 px, karty i panele 22 px); luźny układ, bazowy rozmiar tekstu 17 px na stronie studenta.
- Bilet: gradient indygo (`#4B3FD6` → `#6D5BFF`), biały tekst, wycięcia po bokach i przerywana linia nad składem zespołu — jedyne "głośne" miejsce w aplikacji.
- Wolne sloty na planszy: biała karta z miętowym obramowaniem i napisem "wolny"; zajęte: jasny fiolet.
- Bez trybu ciemnego (propozycja przyjęta bez sprzeciwu; dodać, jeśli potrzebny).
