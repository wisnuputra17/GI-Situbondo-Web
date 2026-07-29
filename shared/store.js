/**
 * shared/store.js
 * State store ringan berbasis pub-sub, dipakai lintas modul agar
 * filter/pilihan (mis. GI aktif) tidak perlu diulang tiap halaman.
 */
function createStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get: (key) => (key ? state[key] : state),
    set: (patch) => {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}

const globalStore = createStore({
  activeGI: null, // id_gi yang sedang difilter/dipilih
  user: null      // reserved — belum ada sistem login saat ini
});
