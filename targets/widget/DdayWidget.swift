import WidgetKit
import SwiftUI

private let appGroup = "group.com.together.ourdays.widget"

struct DdayEntry: TimelineEntry {
    let date: Date
    let days: Int
    let coupleName: String?
}

struct DdayProvider: TimelineProvider {
    func readEntry() -> DdayEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        let anniversary = defaults?.string(forKey: "anniversary")
        let coupleName = defaults?.string(forKey: "coupleName")

        var days = 0
        if let anniversary = anniversary, !anniversary.isEmpty {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.timeZone = TimeZone(identifier: "UTC")
            if let anniversaryDate = formatter.date(from: anniversary) {
                let calendar = Calendar.current
                let startOfAnniversary = calendar.startOfDay(for: anniversaryDate)
                let startOfToday = calendar.startOfDay(for: Date())
                days = (calendar.dateComponents([.day], from: startOfAnniversary, to: startOfToday).day ?? 0) + 1
            }
        }

        return DdayEntry(date: Date(), days: days, coupleName: (coupleName?.isEmpty ?? true) ? nil : coupleName)
    }

    func placeholder(in context: Context) -> DdayEntry {
        DdayEntry(date: Date(), days: 123, coupleName: "우리")
    }

    func getSnapshot(in context: Context, completion: @escaping (DdayEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DdayEntry>) -> Void) {
        let entry = readEntry()
        // D-day는 하루에 한 번만 바뀌므로 다음 자정 이후 한 번만 갱신되도록 예약한다
        let nextMidnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 1),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }
}

struct DdayWidgetView: View {
    var entry: DdayEntry

    var body: some View {
        VStack(spacing: 2) {
            Text("함께한 지")
                .font(.caption2)
            Text("\(entry.days)일째")
                .font(.headline)
        }
    }
}

struct DdayWidget: Widget {
    let kind: String = "DdayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DdayProvider()) { entry in
            DdayWidgetView(entry: entry)
        }
        .configurationDisplayName("함께한 날")
        .description("함께한 지 며칠째인지 잠금화면에서 바로 보여줘요")
        .supportedFamilies([.accessoryRectangular, .accessoryInline])
    }
}

@main
struct DdayWidgetBundle: WidgetBundle {
    var body: some Widget {
        DdayWidget()
    }
}
