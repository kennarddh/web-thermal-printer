/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { FC, useCallback, useRef } from 'react'

import {
	CharacterSet,
	PrinterTypes,
	ThermalPrinter,
} from 'node-thermal-printer'

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

class WebUsbPrinterInterface {
	constructor(
		public device: USBDevice,
		public endpointNumber: number,
	) {}

	getPrinterName() {
		return `Manufacturer: "${this.device.manufacturerName}", Product: "${this.device.productName}"`
	}

	async isPrinterConnected() {
		return this.device.opened
	}

	async execute(buffer: ArrayBuffer) {
		return await this.device.transferOut(this.endpointNumber, buffer)
	}
}

const App: FC = () => {
	const PrinterRef = useRef<ThermalPrinter>(null)

	const Print = useCallback(async () => {
		const printer = PrinterRef.current

		console.log('Print', { printer })

		if (!printer) return

		printer.clear()

		printer.alignCenter()
		printer.println('Store Name')
		printer.println('City')
		printer.println('Province')
		printer.println('Phone Number')

		printer.newLine()

		printer.alignLeft()
		printer.println('17/11/2024 10:20')

		printer.drawLine()

		printer.println('1. Product Name')
		printer.leftRight('   1x Price', 'Price')

		printer.drawLine()

		printer.alignLeft()
		printer.println('Products: 1')
		printer.println('Items: 1')

		printer.drawLine()

		printer.leftRight('Total', 'Price')
		printer.leftRight('Cash', 'Price')
		printer.leftRight('Change', 'Price')

		printer.drawLine()
		printer.newLine()

		printer.alignCenter()
		printer.println('Thank You')

		printer.newLine()
		printer.newLine()

		console.log('Buffer', printer.getBuffer())
		console.log('Text', printer.getText())

		await printer.execute()
	}, [])

	const SelectDevice = useCallback(async () => {
		const device = CreateInterceptor(
			await navigator.usb.requestDevice({
				filters: [{ classCode: 0x07 }],
			}),
		)

		const interfaceNumber = 0

		await device.open()

		if (!device.configuration) {
			await device.selectConfiguration(1) // Or the appropriate config number
			console.log('Configuration selected.')
		} else {
			console.log(
				'Configuration already selected:',
				device.configuration.configurationValue,
			)
		}

		await device.claimInterface(interfaceNumber)
		console.log(`Interface ${interfaceNumber} claimed.`)

		// 3. Find an OUT endpoint on the claimed interface
		// The claimed interface will be in device.configuration.interfaces
		const currentInterface = device.configuration?.interfaces.find(
			iface => iface.interfaceNumber === interfaceNumber && iface.claimed,
		)

		if (!currentInterface) {
			console.error(
				`Could not find claimed interface ${interfaceNumber}. This should not happen.`,
			)
			await device.releaseInterface(interfaceNumber) // Attempt cleanup
			await device.close()
			return
		}

		// Use the current alternate setting of the interface
		const alternateInterface = currentInterface.alternate
		let outEndpoint = null

		for (const endpoint of alternateInterface.endpoints) {
			if (endpoint.direction === 'out') {
				// You might also want to check endpoint.type, e.g., "bulk" or "interrupt"
				// For example: if (endpoint.direction === "out" && endpoint.type === "bulk")
				outEndpoint = endpoint
				break // Found an OUT endpoint, use the first one
			}
		}

		if (!outEndpoint) {
			console.error(
				`No OUT endpoint found on interface ${interfaceNumber}, alternate setting ${alternateInterface.alternateSetting}.`,
			)
			console.log(
				'Available endpoints on this alternate setting:',
				alternateInterface.endpoints,
			)
			await device.releaseInterface(interfaceNumber)
			await device.close()
			return
		}

		PrinterRef.current = new ThermalPrinter({
			type: PrinterTypes.EPSON,
			interface: new WebUsbPrinterInterface(
				device,
				outEndpoint.endpointNumber,
			) as any,
			characterSet: CharacterSet.PC852_LATIN2,
			width: 32,
		})
	}, [])

	return (
		<div>
			<button onClick={SelectDevice}>Select Device</button>
			<button onClick={Print}>Print</button>
		</div>
	)
}

export default App
