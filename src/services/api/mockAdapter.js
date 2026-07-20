// Simulates a network round-trip for mock services so loading/skeleton states
// are exercised the same way they would be against a real API.
// Swap a service's internals for real axiosClient calls later without
// touching any component — the resolved shape stays the same.
export function mockResolve(data, { delay = 450, failRate = 0 } = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (failRate > 0 && Math.random() < failRate) {
        reject({ message: "Network error, please try again.", status: 500 });
      } else {
        resolve(data);
      }
    }, delay);
  });
}
