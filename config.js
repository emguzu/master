/* Połączenie z bazą w chmurze. Puste = tryb podglądu (kopia danych ze snapshot.json).
   supabaseKey to klucz PUBLICZNY (publishable) — może być w tym pliku; dane chroni logowanie i lista panel_users.
   Klucza tajnego (secret / service_role) NIGDY tu nie wpisuj: ma go tylko master.py na komputerach z agentami. */
window.MASTER_CONFIG = {
  supabaseUrl: "https://vldvyqgalstqgcefqhut.supabase.co",
  supabaseKey: "sb_publishable_-J-L2mcwQudp4vU_D7bMHg_OpO9Qu45",
};
