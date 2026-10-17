import Foundation
import Capacitor
import CoreNFC

@objc(FiscusNfcPlugin)
public class FiscusNfcPlugin: CAPPlugin, NFCTagReaderSessionDelegate {

    private var nfcSession: NFCTagReaderSession?
    private let fiscusAidBytes: [UInt8] = [0xF0, 0x46, 0x49, 0x53, 0x43, 0x55, 0x53, 0x01]

    @objc func isSupported(_ call: CAPPluginCall) {
        let readingAvailable = NFCTagReaderSession.readingAvailable
        call.resolve([
            "supported": readingAvailable,
            "enabled": readingAvailable,
            "hceSupported": false,
            "readerSupported": readingAvailable,
            "details": "iOS CoreNFC (ISO 7816 Tag Reader Available)"
        ])
    }

    @objc func openNfcSettings(_ call: CAPPluginCall) {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                call.resolve(["success": true])
            }
        } else {
            call.reject("No se pudo abrir los ajustes de iOS")
        }
    }

    @objc func startHceSession(_ call: CAPPluginCall) {
        // En iOS, el rol de tarjeta (HCE) requiere un contrato comercial y entitlement de Secure Element (iOS 18.1+).
        // En su lugar, el iPhone puede utilizar código QR dinámico de cobro o actuar como pagador/lector.
        call.resolve([
            "success": false,
            "message": "En iPhone el cobro directo requiere entitlement comercial de Apple; usa el modo lector o código QR."
        ])
    }

    @objc func stopHceSession(_ call: CAPPluginCall) {
        call.resolve(["success": true])
    }

    @objc func startReaderMode(_ call: CAPPluginCall) {
        guard NFCTagReaderSession.readingAvailable else {
            call.reject("NFC_NOT_SUPPORTED", "Este modelo de iPhone no soporta lectura NFC.")
            return
        }

        DispatchQueue.main.async {
            self.nfcSession = NFCTagReaderSession(
                pollingOption: [.iso14443],
                delegate: self,
                queue: DispatchQueue.global(qos: .userInitiated)
            )
            self.nfcSession?.alertMessage = "Acerca la parte superior de tu iPhone al otro teléfono o terminal"
            self.nfcSession?.begin()
            call.resolve(["success": true])
        }
    }

    @objc func stopReaderMode(_ call: CAPPluginCall) {
        nfcSession?.invalidate()
        nfcSession = nil
        call.resolve(["success": true])
    }

    // MARK: - NFCTagReaderSessionDelegate

    public func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {
        // Sesión activa con UI del sistema de Apple
    }

    public func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
        let errCode = (error as? NFCReaderError)?.code
        if errCode != .readerSessionInvalidationErrorUserCanceled {
            notifyListeners("onReaderError", data: [
                "code": "READER_SESSION_INVALIDATED",
                "message": error.localizedDescription
            ])
            notifyListeners("readerError", data: [
                "code": "READER_SESSION_INVALIDATED",
                "message": error.localizedDescription
            ])
        }
    }

    public func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        guard let firstTag = tags.first else { return }

        guard case let .iso7816(iso7816Tag) = firstTag else {
            session.invalidate(errorMessage: "Tarjeta o dispositivo no compatible.")
            return
        }

        session.connect(to: firstTag) { [weak self] error in
            guard let self = self else { return }
            if let error = error {
                session.invalidate(errorMessage: "Error de conexión: \(error.localizedDescription)")
                return
            }

            // 1. SELECT AID APDU: 00 A4 04 00 08 F0 46 49 53 43 55 53 01 00
            let selectApdu = NFCISO7816APDU(
                instructionClass: 0x00,
                instructionCode: 0xA4,
                p1Parameter: 0x04,
                p2Parameter: 0x00,
                data: Data(self.fiscusAidBytes),
                expectedResponseLength: -1
            )

            iso7816Tag.sendCommand(apdu: selectApdu) { responseData, sw1, sw2, err in
                if sw1 != 0x90 || sw2 != 0x00 {
                    session.invalidate(errorMessage: "Dispositivo no reconocido como Fiscus Tap.")
                    return
                }

                // 2. GET TRANSACTION DETAILS APDU: 00 10 00 00 00
                let getDetailsApdu = NFCISO7816APDU(
                    instructionClass: 0x00,
                    instructionCode: 0x10,
                    p1Parameter: 0x00,
                    p2Parameter: 0x00,
                    data: Data(),
                    expectedResponseLength: -1
                )

                iso7816Tag.sendCommand(apdu: getDetailsApdu) { detailsData, dSw1, dSw2, dErr in
                    if dSw1 != 0x90 || dSw2 != 0x00 {
                        session.invalidate(errorMessage: "Fallo al leer datos del cobro.")
                        return
                    }

                    if let jsonStr = String(data: detailsData, encoding: .utf8) {
                        session.alertMessage = "¡Cobro detectado con éxito!"
                        session.invalidate()

                        var dict: [String: Any] = ["rawPayload": jsonStr]
                        if let jsonData = jsonStr.data(using: .utf8),
                           let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                            dict["payload"] = parsed
                            if let sId = parsed["sessionId"] { dict["sessionId"] = sId }
                            if let amt = parsed["amount"] { dict["amount"] = amt }
                            if let curr = parsed["currency"] { dict["currency"] = curr }
                            if let mName = parsed["merchantName"] { dict["merchantName"] = mName }
                            if let mPhone = parsed["merchantPhone"] { dict["merchantPhone"] = mPhone }
                        }

                        self.notifyListeners("onTagDiscovered", data: dict)
                        self.notifyListeners("nfcTagDiscovered", data: dict)
                    } else {
                        session.invalidate(errorMessage: "Carga útil no válida.")
                    }
                }
            }
        }
    }
}
