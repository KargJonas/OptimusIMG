import { ILazyLoad, ILazyLoadCarouselInterval } from './interfaces/lazy_load.interface';
import { consoleMessage } from './helpers/console.helpers';

// For ensuring all events are properly cleared from whichever instance of LazyLoad, eg. if user does new LazyLoad(); multiple times
let cachedLazyLoadRef: LazyLoad;

export default class LazyLoad {
    constructor(configuration?: ILazyLoad) {
        if (configuration) {
            this._configuration = {...this._configuration, ...configuration};
        }

        this.execute();
        cachedLazyLoadRef = this;
        this._cachedLazyLoadRef = cachedLazyLoadRef;
    }

    private readonly _cachedLazyLoadRef: LazyLoad | undefined = cachedLazyLoadRef;

    private readonly _configuration: ILazyLoad = {
        className: 'optimusIMG',
        carouselClassName: 'optimusIMG-carousel',
        carouselToggleImageBtn: 'optimusIMG-carousel--toggle-btn',
    };

    private _carouselIntervals: ILazyLoadCarouselInterval[] = [];

    public execute(): void {
        this._carouselIntervals.forEach((interval: ILazyLoadCarouselInterval) => window.clearInterval(interval.uuid));
        this._carouselIntervals = [];
        this.images();
        this.carousels();
    }

    private images(): void {
        const SELECTOR: string = 'img.' + this._configuration.className;
        const IMAGES: NodeListOf<HTMLImageElement> = document.querySelectorAll(SELECTOR) as NodeListOf<HTMLImageElement>;

        this.loadImagesNearOrInView(IMAGES, true);

        const LOAD_IMAGES: any = (): void => this.loadImagesBeingScrolledInView();

        // Prevent multiple scroll event listeners being attached in case lazy load is enabled in an SPA environment
        document.removeEventListener('scroll', LOAD_IMAGES);
        document.addEventListener('scroll', LOAD_IMAGES, {passive: true});
    }

    private carousels(): void {
        const SELECTOR: string = '.' + this._configuration.carouselClassName;
        const CAROUSEL: NodeListOf<HTMLElement> = document.querySelectorAll(SELECTOR);

        CAROUSEL.forEach((carousel: HTMLElement, index: number) => {
            const IMAGES: NodeListOf<HTMLImageElement> = carousel.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
            this.loadCarouselImageOnEventOnChangeIntent(carousel);

            if (carousel.getAttribute('data-optimus-interval') !== null) {
                const INTERVAL_TIME: number = parseInt(carousel.getAttribute('data-optimus-interval') as string, 10);
                this.addLoadedPropertiesToImage(IMAGES[0]);

                const INTERVAL: number = window.setInterval(() => {
                    const IMG: HTMLImageElement | null = carousel.querySelector('img:not([data-optimus-loaded="true"])');

                    if (IMG) {
                        this.addLoadedPropertiesToImage(IMG);
                    } else {
                        const IVAL: ILazyLoadCarouselInterval = this._carouselIntervals
                            .find((interval: ILazyLoadCarouselInterval) => interval.key === index) as ILazyLoadCarouselInterval;

                        window.clearInterval(IVAL.uuid);

                        // Remove interval from the list of existing intervals.
                        this._carouselIntervals = this._carouselIntervals.filter((interval: ILazyLoadCarouselInterval) => interval.key !== index);
                    }

                }, INTERVAL_TIME - 1000);

                this._carouselIntervals.push({key: index, uuid: INTERVAL});
            } else {
                console.warn(consoleMessage('carousel is missing data-optimus-interval property'), carousel);

                IMAGES.forEach((image: HTMLImageElement) => {
                    this.addLoadedPropertiesToImage(image);
                });
            }
        });
    }

    private loadImagesBeingScrolledInView(): void {
        const SELECTOR: string = 'img.' + this._configuration.className + ':not([data-optimus-loaded="true"])';
        const IMAGES: NodeListOf<HTMLImageElement> = document.querySelectorAll(SELECTOR) as NodeListOf<HTMLImageElement>;

        if (IMAGES.length > 0) {
            this.loadImagesNearOrInView(IMAGES, false);
        }
    }

    private loadImagesNearOrInView(images: NodeListOf<HTMLImageElement>, initialLoad: boolean): void {
        const MARGIN: number = initialLoad ? 300 : 100;

        const VISIBLE_AREA: {[position: string]: number} = {
            topEdge: window.scrollY - MARGIN,
            bottomEdge: window.innerHeight + window.scrollY + MARGIN,
        };

        images.forEach((image: HTMLImageElement) => {
            const IMAGE_POS_Y_TOP: number = image.getBoundingClientRect().top + window.scrollY;
            const IMAGE_POS_Y_BOTTOM: number = image.getBoundingClientRect().bottom + window.scrollY;

            // Load all images that are already on the screen or near the screen edge immediately
            if (VISIBLE_AREA.topEdge < IMAGE_POS_Y_BOTTOM && IMAGE_POS_Y_TOP < VISIBLE_AREA.bottomEdge) {
                this.addLoadedPropertiesToImage(image);
            }
        });
    }

    private loadCarouselImageOnEventOnChangeIntent(carousel: HTMLElement): void {
        const TOGGLE_IMG: NodeListOf<HTMLElement> = carousel.querySelectorAll('.' + this._configuration.carouselToggleImageBtn);

        TOGGLE_IMG.forEach((btn: HTMLElement) => {
           if (this._cachedLazyLoadRef) {
               btn.removeEventListener('mouseover', cachedLazyLoadRef.loadCarouselImageOnEvent);
               btn.removeEventListener('mousedown', cachedLazyLoadRef.loadCarouselImageOnEvent);
               btn.removeEventListener('touchstart', cachedLazyLoadRef.loadCarouselImageOnEvent);
           }

           // Mouseover listener is added so image starts getting loaded slightly before a user might click on the button
           btn.addEventListener('mouseover', this.loadCarouselImageOnEvent);

           // Mousedown event listeners are needed in case the user does not move the mouse to trigger mouseover again
           btn.addEventListener('mousedown', this.loadCarouselImageOnEvent);

           // Touchstart listeners are needed for mobile users
           btn.addEventListener('touchstart', this.loadCarouselImageOnEvent);
        });
    }

    private loadCarouselImageOnEvent = (ev: Event): void => {
        const BTN: HTMLElement = ev.target as HTMLElement;
        const INDEX: string | null = BTN.getAttribute('data-optimus-img-index');
        const CAROUSEL: HTMLElement = BTN.closest('.' + this._configuration.carouselClassName) as HTMLElement;
        const IMAGES: NodeListOf<HTMLImageElement> = CAROUSEL.querySelectorAll('img') as NodeListOf<HTMLImageElement>;

        if (INDEX === 'next') {
            Array.from(IMAGES).some((image: HTMLImageElement, index: number) => {
                // Determine whether an image is visible or not
                if (image.offsetParent !== null || image.getBoundingClientRect().height > 0) {
                    if (index === IMAGES.length - 1) {
                        // First image is loaded by default anyway
                        return true;
                    }

                    this.addLoadedPropertiesToImage(IMAGES[index + 1]);

                    return true;
                }

                return false;
            });
        } else if (INDEX === 'previous') {
            Array.from(IMAGES).some((image: HTMLImageElement, index: number) => {
                // Determine whether an image is visible or not
                if (image.offsetParent !== null || image.getBoundingClientRect().height > 0) {
                    const PREVIOUS_INDEX: number = index === 0 ? IMAGES.length - 1 : index - 1;
                    this.addLoadedPropertiesToImage(IMAGES[PREVIOUS_INDEX]);

                    return true;
                }

                return false;
            });
        } else if (INDEX === null) {
            console.warn(consoleMessage('toggle button is missing data-optimus-img-index property'), BTN);
        } else {
            this.addLoadedPropertiesToImage(IMAGES[Number(INDEX)]);
        }
    }

    private addLoadedPropertiesToImage(image: HTMLImageElement): void {
        image.src = image.getAttribute('data-optimus-lazy-src') as string;
        image.setAttribute('data-optimus-loaded', 'true');
    }
}
