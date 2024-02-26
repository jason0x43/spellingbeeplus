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

  func beginRequest(with context: NSExtensionContext) {
    let item = context.inputItems[0] as! NSExtensionItem
    let message = item.userInfo?[SFExtensionMessageKey]
    let messageDict = message as! NSDictionary
    let response = NSExtensionItem()

    if let type = messageDict.value(forKey: "type") as? String {
      if type == "getConfig" {
        response.userInfo = [SFExtensionMessageKey: [
          "apiKey": apiKey,
          "apiHost": apiHost
        ]]
      }
    }

    context.completeRequest(returningItems: [response], completionHandler: nil)
  }

}
