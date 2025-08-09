import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, PenTool as Tool, DollarSign, Shield, ArrowLeft, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Equipment {
  id: string;
  title: string;
  description: string;
  type: string;
  location: string;
  rate: number;
  status: string;
  user_id: string;
  user_profiles?: {
    id: string;
    company_name: string;
    full_name: string;
    email: string;
  };
  images: {
    id: string;
    image_url: string;
    is_main: boolean;
  }[];
  features: string[];
}

interface BookingData {
  startDate: string;
  endDate: string;
  notes: string;
}

const EquipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData>({
    startDate: '',
    endDate: '',
    notes: ''
  });
  const [duration, setDuration] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch equipment details when id changes
  useEffect(() => {
    if (id) {
      fetchEquipmentDetails();
    }
  }, [id]);

  // Recompute totals when duration or rate changes
  useEffect(() => {
    if (duration > 0 && equipment?.rate) {
      const subtotal = duration * equipment.rate;
      const serviceFee = Math.round(subtotal * 0.05); // 5% service fee
      setTotalAmount(subtotal + serviceFee);
    } else {
      setTotalAmount(0);
    }
  }, [duration, equipment?.rate]);

  const checkAuth = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      navigate('/auth');
    }
  };

  const fetchEquipmentDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          user_profiles!equipment_user_id_fkey (
            id,
            company_name,
            full_name,
            email
          ),
          equipment_images (
            id,
            image_url,
            is_main
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        // Sort images with main image first
        const sortedImages = data.equipment_images?.sort((a, b) => 
          b.is_main ? 1 : a.is_main ? -1 : 0
        ) || [];

        setEquipment({
          ...data,
          images: sortedImages,
          features: data.features || []
        });
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newBookingData = { ...bookingData, [field]: value };
    setBookingData(newBookingData);

    if (newBookingData.startDate && newBookingData.endDate) {
      const days = calculateDuration(newBookingData.startDate, newBookingData.endDate);
      setDuration(days);
    } else {
      setDuration(0);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !equipment) return;

    // Prevent self-booking
    if (user.id === equipment.user_id) {
      alert('You cannot book your own equipment');
      return;
    }

    // Validate dates
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      alert('Start date cannot be in the past');
      return;
    }

    if (startDate >= endDate) {
      alert('End date must be after start date');
      return;
    }

    if (duration < 1) {
      alert('Minimum booking duration is 1 day');
      return;
    }

    try {
      setSubmitting(true);

      const subtotal = duration * equipment.rate;
      const serviceFee = Math.round(subtotal * 0.05); // 5% service fee
      const total = subtotal + serviceFee;

      const { error } = await supabase
        .from('bookings')
        .insert([{
          equipment_id: equipment.id,
          user_id: user.id, // renter_id in the context
          start_date: bookingData.startDate,
          end_date: bookingData.endDate,
          days: duration,
          rate_per_day: equipment.rate,
          subtotal: subtotal,
          service_fee: serviceFee,
          total_amount: total,
          status: 'pending',
          notes: bookingData.notes || null
        }]);

      if (error) throw error;

      // Success feedback
      setShowBookingModal(false);
      alert('Booking request sent successfully! The owner will review and respond.');
      
      // Navigate to renter dashboard bookings
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to submit booking request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = user && equipment && user.id === equipment.user_id;
  const imagesToShow = equipment?.images?.map(img => img.image_url) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading equipment details...</p>
        </div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Equipment Not Found</h2>
          <Link to="/equipment" className="text-yellow-600 hover:text-yellow-700">
            Back to Equipment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        <Link to="/equipment" className="inline-flex items-center text-gray-600 hover:text-yellow-600 mb-6">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Equipment
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Images */}
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              {imagesToShow.length > 0 ? (
                <div className="space-y-4">
                  <img
                    src={imagesToShow[currentImageIndex]}
                    alt={equipment.title}
                    className="w-full h-[400px] object-cover rounded-lg"
                  />
                  {imagesToShow.length > 1 && (
                    <div className="flex space-x-2 overflow-x-auto">
                      {imagesToShow.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                            currentImageIndex === index ? 'border-yellow-500' : 'border-gray-200'
                          }`}
                        >
                          <img
                            src={image}
                            alt={`${equipment.title} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-[400px] bg-gray-200 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">No images available</p>
                </div>
              )}
            </div>
            
            {equipment.features && equipment.features.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold mb-4">Features & Specifications</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {equipment.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Tool className="h-5 w-5 text-yellow-600 mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-3xl font-bold text-gray-800">{equipment.title}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  equipment.status === 'available' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {equipment.status === 'available' ? 'Available Now' : equipment.status}
                </span>
              </div>

              <div className="flex items-center mb-4">
                <MapPin className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-gray-600">{equipment.location}</span>
              </div>

              <p className="text-gray-600 mb-6">{equipment.description}</p>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
                <div className="flex items-center">
                  <DollarSign className="h-6 w-6 text-yellow-600 mr-2" />
                  <div>
                    <p className="text-2xl font-bold text-gray-800">R{equipment.rate}</p>
                    <p className="text-sm text-gray-500">per day</p>
                  </div>
                </div>
                {isOwner ? (
                  <div className="text-center">
                    <button 
                      disabled
                      className="px-6 py-3 bg-gray-300 text-gray-500 rounded-lg font-semibold cursor-not-allowed"
                      title="You can't book your own equipment"
                    >
                      Your Equipment
                    </button>
                    <p className="text-xs text-gray-500 mt-1">You can't book your own equipment</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowBookingModal(true)}
                    className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
                    disabled={equipment.status !== 'available'}
                  >
                    Book Now
                  </button>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-bold mb-4">Equipment Provider</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {equipment.user_profiles?.company_name || equipment.user_profiles?.full_name || 'Equipment Owner'}
                    </p>
                    <p className="text-sm text-gray-500">{equipment.user_profiles?.email}</p>
                  </div>
                  <button className="px-4 py-2 border border-yellow-600 text-yellow-600 rounded-lg hover:bg-yellow-600 hover:text-white transition-colors">
                    Contact
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center mb-4">
                <Shield className="h-5 w-5 text-yellow-600 mr-2" />
                <h3 className="text-lg font-semibold">Rental Protection</h3>
              </div>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center">
                  <span className="h-2 w-2 bg-yellow-600 rounded-full mr-2"></span>
                  Verified equipment provider
                </li>
                <li className="flex items-center">
                  <span className="h-2 w-2 bg-yellow-600 rounded-full mr-2"></span>
                  Secure payments through our platform
                </li>
                <li className="flex items-center">
                  <span className="h-2 w-2 bg-yellow-600 rounded-full mr-2"></span>
                  24/7 customer support
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Book Equipment</h2>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">{equipment.title}</h3>
                <p className="text-gray-600">Daily Rate: R{equipment.rate}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline-block h-4 w-4 mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline-block h-4 w-4 mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    min={bookingData.startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    rows={4}
                    placeholder="Any special requirements or questions?"
                  />
                </div>
              </div>

              {duration > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{duration} day{duration !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">R{duration * equipment.rate}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Service Fee (5%):</span>
                    <span className="font-medium">R{Math.round(duration * equipment.rate * 0.05)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold text-lg">R{totalAmount}</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                  <div>
                    <h4 className="text-blue-800 font-medium">Booking Request</h4>
                    <p className="text-blue-600 text-sm mt-1">
                      This is a booking request. The equipment owner will review and respond. 
                      Minimum booking: 1 day.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  disabled={submitting || duration < 1}
                >
                  {submitting ? 'Submitting...' : 'Request Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentDetails;