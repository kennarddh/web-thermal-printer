/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import { FC, useCallback, useEffect, useRef } from 'react'

import {
	CharacterSet,
	PrinterTypes,
	ThermalPrinter,
} from 'node-thermal-printer'

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

const interfaceNumber = 0

const App: FC = () => {
	const PrinterRef = useRef<ThermalPrinter>(null)
	const DeviceRef = useRef<USBDevice>(null)
	const IsFirstLoadRef = useRef<boolean>(true)

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

		await printer.execute()
	}, [])

	const DisconnectDevice = useCallback(async () => {
		const device = DeviceRef.current

		if (!device) return

		if (device.opened) {
			try {
				// Check if the specific interface was claimed before trying to release
				const ifaceToRelease = device.configuration?.interfaces.find(
					iface =>
						iface.interfaceNumber === interfaceNumber &&
						iface.claimed,
				)

				if (ifaceToRelease) {
					await device.releaseInterface(interfaceNumber)

					console.log(
						`Interface ${interfaceNumber} released during error handling.`,
					)
				}
			} catch (releaseError) {
				console.warn(
					'Error releasing interface during cleanup:',
					releaseError,
				)
			}

			try {
				await device.close()

				console.log('Device closed during error handling.')
			} catch (closeError) {
				console.warn('Error closing device during cleanup:', closeError)
			}
		}
	}, [])

	const ConfigureDevice = useCallback(async () => {
		const device = DeviceRef.current

		if (!device) return

		try {
			await device.open()

			if (!device.configuration) {
				await device.selectConfiguration(1)
			}

			await device.claimInterface(interfaceNumber)

			const currentInterface = device.configuration?.interfaces.find(
				iface =>
					iface.interfaceNumber === interfaceNumber && iface.claimed,
			)

			if (!currentInterface) {
				console.error(
					`Could not find claimed interface ${interfaceNumber}. This should not happen.`,
				)

				await device.releaseInterface(interfaceNumber)
				await device.close()

				return
			}

			const alternateInterface = currentInterface.alternate
			const outEndpoint = alternateInterface.endpoints.find(
				endpoint =>
					endpoint.direction === 'out' && endpoint.type === 'bulk',
			)

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

			return outEndpoint.endpointNumber
		} catch (error) {
			console.error('WebUSB Error:', error)

			// Attempt to clean up if device is open and an interface might be claimed
			await DisconnectDevice()
		}
	}, [DisconnectDevice])

	const ConfigurePrinter = useCallback((endpointNumber: number) => {
		if (!DeviceRef.current) return

		PrinterRef.current = new ThermalPrinter({
			type: PrinterTypes.EPSON,
			interface: new WebUsbPrinterInterface(
				DeviceRef.current,
				endpointNumber,
			) as any,
			characterSet: CharacterSet.PC852_LATIN2,
			width: 32,
		})
	}, [])

	const SelectDevice = useCallback(async () => {
		const device = await navigator.usb.requestDevice({
			filters: [{ classCode: 0x07 }],
		})

		if (DeviceRef.current !== device) {
			await DisconnectDevice()
		}

		DeviceRef.current = device

		const endpointNumber = await ConfigureDevice()

		if (!endpointNumber) return

		ConfigurePrinter(endpointNumber)
	}, [ConfigureDevice, ConfigurePrinter, DisconnectDevice])

	useEffect(() => {
		if (!IsFirstLoadRef.current) return

		IsFirstLoadRef.current = false

		const main = async () => {
			const devices = await navigator.usb.getDevices()

			const device = devices[0]

			if (!device) return

			DeviceRef.current = device

			const endpointNumber = await ConfigureDevice()

			if (!endpointNumber) return

			ConfigurePrinter(endpointNumber)
		}

		main().catch((error: unknown) => {
			console.log('Init device error', error)
		})

		return () => {
			DisconnectDevice().catch((error: unknown) => {
				console.log('Init device disconnect error', error)
			})
		}
	}, [ConfigureDevice, ConfigurePrinter, DisconnectDevice])

	return (
		<div>
			<button onClick={SelectDevice}>Select Device</button>
			<button onClick={Print}>Print</button>
		</div>
	)
}

export default App
