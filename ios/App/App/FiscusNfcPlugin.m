#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(FiscusNfcPlugin, "FiscusNfc",
    CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(openNfcSettings, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startHceSession, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopHceSession, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startReaderMode, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopReaderMode, CAPPluginReturnPromise);
)
