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
  let teamId = Bundle.main.object(forInfoDictionaryKey: "TEAM_ID") as? String
  let extensionId = "\(Bundle.main.bundleIdentifier!).Extension"

  func beginRequest(with context: NSExtensionContext) {
    let item = context.inputItems.first as! NSExtensionItem
    let message = item.userInfo?[SFExtensionMessageKey]
    let messageDict = message as! NSDictionary
    let response = NSExtensionItem()

    if let type = messageDict.value(forKey: "type") as? String {
      if type == "getConfig" {
        response.userInfo = [SFExtensionMessageKey: [
          "apiKey": apiKey,
          "apiHost": apiHost,
          "appVersion": "\(version ?? "")(\(build ?? ""))",
          "extensionId": extensionId,
          "teamId": teamId,
        ]]
      }
    }

    context.completeRequest(returningItems: [response], completionHandler: nil)
  }

}
