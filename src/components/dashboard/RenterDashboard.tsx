import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// TODO: RenterDashboard will render "Continue to Payment" for accepted bookings,
// which navigates to /payments/checkout/:bookingId (placeholder route).
const RenterDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    activeBookings: 0,
    totalBookings: 0,
    pendingBookings: 0,
  });

  useEffect(() => {
    fetchRenterData();
  }, []);

  const fetchRenterData = async () => {
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(`
        *,
        equipment:equipment_id (title, rate)
      `)
      .order('created_at', { ascending: false });

    if (bookingsData) {
      setBookings(bookingsData);
      setStats({
        activeBookings: bookingsData.filter(b => b.status === 'active').length,
        totalBookings: bookingsData.length,
        pendingBookings: bookingsData.filter(b => b.status === 'pending').length,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Active Rentals</p>
              <h3 className="text-2xl font-bold">{stats.activeBookings}</h3>
            </div>
            <Calendar className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Pending Requests</p>
              <h3 className="text-2xl font-bold">{stats.pendingBookings}</h3>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Total Bookings</p>
              <h3 className="text-2xl font-bold">{stats.totalBookings}</h3>
            </div>
            <CheckCircle className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="flex space-x-4">
          <Link
            to="/equipment"
            className="flex-1 bg-yellow-600 text-white rounded-lg p-4 flex items-center justify-center hover:bg-yellow-700 transition-colors"
          >
            <Search className="h-5 w-5 mr-2" />
            Browse Equipment
          </Link>
        </div>
      </div>

      {/* Bookings List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-6">Your Bookings</h2>
        <div className="space-y-4">
          {bookings.map((booking: any) => (
            <div key={booking.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{booking.equipment?.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  booking.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : booking.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : booking.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {booking.status}
                </span>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-gray-600">
                  Total: R{booking.equipment?.rate * Math.ceil(
                    (new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / (1000 * 60 * 60 * 24)
                  )}
                </span>
                <Link
                  to={`/equipment/${booking.equipment_id}`}
                  className="text-yellow-600 hover:text-yellow-700"
                >
                  View Equipment
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RenterDashboard;