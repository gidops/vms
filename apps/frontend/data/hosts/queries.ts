import { useQuery } from "@tanstack/react-query";
import { hostsApi } from "./hosts.api";

/** Hosts (STAFF users) for the invite/walk-in host picker. */
export function useHosts() {
  return useQuery({ queryKey: ["hosts"], queryFn: () => hostsApi.list() });
}
