import { FC, useCallback, useRef } from 'react'

import { Printer, WebUSB } from 'escpos-buffer'

const CreateInterceptor = <T extends object>(target: T) => {
	const handler: ProxyHandler<T> = {
		get: (target, prop) => {
			const originalValue = (target as any)[prop]

			if (typeof originalValue === 'function') {
				return function (...args: any[]) {
					console.log(
						`Function "${prop as any}" called with arguments:`,
						args,
					)
					const result = originalValue.apply(target, args)
					console.log(`Function "${prop as any}" returned:`, result)
					return result
				}
			}
			return originalValue
		},
	}

	return new Proxy(target, handler)
}
const App: FC = () => {
	const PrinterRef = useRef<Printer>(null)

	const Print = useCallback(async () => {
		const printer = PrinterRef.current

		console.log({ printer })

		if (!printer) return

		await printer.setColumns(56)
		await printer.writeln('Simple Text *** ')
		await printer.feed(2)
	}, [])

	const SelectDevice = useCallback(async () => {
		const device = await navigator.usb.requestDevice({
			filters: [{ classCode: 0x07 }],
		})

		const connection = new WebUSB(device)
		PrinterRef.current = await Printer.CONNECT(
			'TM-T20',
			CreateInterceptor(connection),
		)
	}, [])

	return (
		<div>
			<button onClick={SelectDevice}>Select Device</button>
			<button onClick={Print}>Print</button>
		</div>
	)
}

export default App
