/** Mach VM region walker via FFI (self-process). */
import { dlopen, FFIType, ptr } from "bun:ffi"

const k = dlopen("/usr/lib/system/libsystem_kernel.dylib", {
  mach_task_self: { args: [], returns: FFIType.u64 },
  mach_vm_region: {
    args: [FFIType.u64, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
})

/** Walk own VM map; count total regions and ~128K ones. */
export function countRegions(): { total: number; r128k: number } {
  const task = (k.symbols.mach_task_self as any)() as number
  const addr = new BigUint64Array(1)
  const size = new BigUint64Array(1)
  const info = new Uint32Array(16)
  const infoCnt = new Uint32Array(1)
  const objectName = new Uint32Array(1)
  let total = 0
  let r128k = 0
  addr[0] = 1n
  const walk = k.symbols.mach_vm_region as any
  for (;;) {
    infoCnt[0] = 16
    const kr = walk(BigInt(task), ptr(addr), ptr(size), 9, ptr(info), ptr(infoCnt), ptr(objectName))
    if (kr !== 0) break
    total++
    if (size[0] >= 131072n && size[0] <= 139264n) r128k++
    addr[0] = addr[0] + size[0]
    if (addr[0] === 0n || total > 500000) break
  }
  return { total, r128k }
}
