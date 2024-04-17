//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Jason on 2/27/22.
//

import SafariServices
import os.log

let SFExtensionMessageKey = "message"

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
  let apiKey = Bundle.main.object(forInfoDictionaryKey: "API_KEY") as? String
  let apiHost = Bundle.main.object(forInfoDictionaryKey: "API_HOST") as? String
  let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
  let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String

  func beginRequest(with context: NSExtensionContext) {
    let item = context.inputItems[0] as! NSExtensionItem
    let message = item.userInfo?[SFExtensionMessageKey]
    let messageDict = message as! NSDictionary
    let response = NSExtensionItem()

    if let type = messageDict.value(forKey: "type") as? String {
      if type == "getConfig" {
        response.userInfo = [SFExtensionMessageKey: [
          "apiKey": apiKey,
          "apiHost": apiHost,
          "appVersion": "\(version ?? "")(\(build ?? ""))"
        ]]
      }
    }

    context.completeRequest(returningItems: [response], completionHandler: nil)
  }

}
