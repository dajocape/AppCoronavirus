import { NgModule } from '@angular/core';
import { TimeSeriesPlotComponent } from './time-series-plot/time-series-plot';
import { StatsSegmentComponent } from './stats-segment/stats-segment';
import { MapsSegmentComponent } from './maps-segment/maps-segment';
import { IonicModule } from 'ionic-angular';
import { TimeSeriesComparePlotComponent } from './time-series-compare-plot/time-series-compare-plot';
import { BarPlotComponent } from './bar-plot/bar-plot';
import { MapComponent } from './map/map';
@NgModule({
	declarations: [TimeSeriesPlotComponent,
    StatsSegmentComponent,
    MapsSegmentComponent,
    TimeSeriesComparePlotComponent,
    BarPlotComponent,
    MapComponent],
	imports: [IonicModule],
	exports: [TimeSeriesPlotComponent,
    StatsSegmentComponent,
    MapsSegmentComponent,
    TimeSeriesComparePlotComponent,
    BarPlotComponent,
    MapComponent]
})
export class ComponentsModule {}